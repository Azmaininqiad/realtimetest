"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google" // Using the specific Google provider for Gemini
import { revalidatePath } from "next/cache"

type QuestionOption = {
  text: string
  is_correct: boolean
}

type QuestionPayload = {
  question_text: string
  type: "text" | "multiple_choice" | "file_upload"
  options?: QuestionOption[] // For multiple_choice
  teacher_attachment_url?: string
  teacher_attachment_filename?: string
  points: number
}

export async function createExamAction(formData: FormData) {
  const supabase = createSupabaseServerClient()

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const durationMinutes = Number.parseInt(formData.get("durationMinutes") as string, 10)
  const startTime = formData.get("startTime") ? new Date(formData.get("startTime") as string).toISOString() : null

  const rawQuestions: QuestionPayload[] = []
  const questionFiles: { index: number; file: File }[] = []

  formData.forEach((value, key) => {
    const questionMatch = key.match(/^questions\[(\d+)\]\[(.+)\]$/)
    if (questionMatch) {
      const index = Number.parseInt(questionMatch[1], 10)
      const field = questionMatch[2]
      if (!rawQuestions[index]) rawQuestions[index] = {} as QuestionPayload

      if (field === "options") {
        rawQuestions[index][field] = JSON.parse(value as string)
      } else if (field === "points") {
        rawQuestions[index][field] = Number.parseInt(value as string, 10)
      } else {
        ;(rawQuestions[index] as any)[field] = value
      }
    }
    const fileMatch = key.match(/^question_attachment_(\d+)$/)
    if (fileMatch && value instanceof File) {
      questionFiles.push({ index: Number.parseInt(fileMatch[1], 10), file: value })
    }
  })

  if (!title || !durationMinutes || rawQuestions.length === 0) {
    return { error: "Missing required fields: title, duration, or questions." }
  }

  try {
    // 1. Generate exam code first
    const { data: examCodeData, error: codeError } = await supabase.rpc("generate_exam_code")

    if (codeError || !examCodeData) {
      console.error("Failed to generate exam code:", codeError)
      return { error: "Failed to generate exam code. Please try again." }
    }

    const examCode = examCodeData as string

    // 2. Create the exam to get its ID
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert({
        title,
        description: description || null,
        exam_code: examCode,
        duration_minutes: durationMinutes,
        start_time: startTime,
        // host_id: null // We'll add this when we implement auth
      })
      .select("id")
      .single()

    if (examError || !exam) {
      console.error("Supabase exam insert error:", examError)

      // More specific error messages
      if (examError?.message?.includes("row-level security")) {
        return {
          error: "Database security error. Please check your Supabase RLS policies or disable RLS for development.",
        }
      }

      return { error: `Failed to create exam: ${examError?.message || "Unknown database error"}` }
    }

    // 3. Upload question attachments if any
    for (const { index, file } of questionFiles) {
      if (rawQuestions[index]) {
        const filePath = `teacher_attachments/${exam.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from("exam_files").upload(filePath, file)

        if (uploadError) {
          console.warn(`Failed to upload attachment for question ${index}: ${uploadError.message}`)
          // Continue without the attachment rather than failing completely
        } else {
          const { data: publicUrlData } = supabase.storage.from("exam_files").getPublicUrl(filePath)
          if (publicUrlData?.publicUrl) {
            rawQuestions[index].teacher_attachment_url = publicUrlData.publicUrl
            rawQuestions[index].teacher_attachment_filename = file.name
          }
        }
      }
    }

    // 4. Prepare and insert questions
    const questionsToInsert = rawQuestions.map((q, index) => ({
      exam_id: exam.id,
      question_text: q.question_text,
      type: q.type,
      options: q.type === "multiple_choice" ? q.options : null,
      teacher_attachment_url: q.teacher_attachment_url || null,
      teacher_attachment_filename: q.teacher_attachment_filename || null,
      points: q.points || 10,
      sort_order: index + 1,
    }))

    const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)

    if (questionsError) {
      console.error("Supabase questions insert error:", questionsError)

      if (questionsError?.message?.includes("row-level security")) {
        return { error: "Database security error when saving questions. Please check your Supabase RLS policies." }
      }

      return { error: `Failed to save questions: ${questionsError.message}` }
    }

    revalidatePath("/host/create-exam")
    return { success: true, examCode: examCode }
  } catch (e: any) {
    console.error("Error in createExamAction:", e)
    return { error: `An unexpected error occurred: ${e.message}` }
  }
}

export async function generateQuestionWithAI(topic: string, questionType: "text" | "multiple_choice" | "file_upload") {
  try {
    // Check if Google API key is available
    if (!process.env.GOOGLE_API_KEY) {
      return { error: "AI question generation is not configured. Please set GOOGLE_API_KEY environment variable." }
    }

    let prompt = `Generate a ${questionType} question about "${topic}". `
    if (questionType === "multiple_choice") {
      prompt += `Provide 4 options, and clearly indicate the correct answer. Format the output as a JSON object with "question_text" (string) and "options" (array of objects, each with "text" (string) and "is_correct" (boolean)). One option must be correct.`
    } else if (questionType === "text") {
      prompt += `The question should require a short text answer. Format the output as a JSON object with "question_text" (string).`
    } else {
      // file_upload or other types
      prompt += `The question should require a file upload as an answer. Format the output as a JSON object with "question_text" (string).`
    }

    const { text } = await generateText({
      model: google("models/gemini-1.5-flash-latest"),
      prompt: prompt,
    })

    // Attempt to parse the JSON response
    try {
      const parsedResponse = JSON.parse(text)
      if (!parsedResponse.question_text) {
        return { error: "AI response did not contain question text." }
      }
      if (
        questionType === "multiple_choice" &&
        (!parsedResponse.options ||
          !Array.isArray(parsedResponse.options) ||
          parsedResponse.options.length === 0 ||
          !parsedResponse.options.some((opt: any) => opt.is_correct))
      ) {
        return { error: "AI response for multiple choice was not formatted correctly or lacked a correct answer." }
      }
      return { generatedQuestion: parsedResponse }
    } catch (parseError) {
      console.error("AI response parsing error:", parseError, "Raw text:", text)
      // Fallback for non-JSON or poorly formatted JSON for simple text questions
      if (questionType === "text" || questionType === "file_upload") {
        return { generatedQuestion: { question_text: text.trim() } }
      }
      return { error: "AI response was not in the expected JSON format." }
    }
  } catch (e: any) {
    console.error("AI generation error:", e)
    return { error: `Failed to generate question with AI: ${e.message}` }
  }
}
