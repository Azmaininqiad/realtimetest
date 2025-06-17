// Placeholder for the page where students take the exam
// This will be a client component to manage state, timer, and submissions
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client" // client-side supabase

// Define types for better code structure
type QuestionOption = {
  text: string
  // is_correct is typically not sent to the client during the exam
}

type Question = {
  id: string
  question_text: string
  type: "text" | "multiple_choice" | "file_upload"
  options?: QuestionOption[] // For multiple_choice
  teacher_attachment_url?: string
  teacher_attachment_filename?: string
  points: number
}

type ExamDetails = {
  id: string
  title: string
  description?: string
  start_time?: string // ISO string
  duration_minutes: number
  questions: Question[]
}

type Answer = {
  question_id: string
  answer_text?: string
  selected_option_index?: number
  answer_file?: File
}

export default function TakeExamPage({ params }: { params: { examCode: string } }) {
  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null) // in seconds
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studentIdentifier, setStudentIdentifier] = useState<string>("") // For anonymous or simple ID
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [examFinishedMessage, setExamFinishedMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // Generate a simple student identifier or prompt for name/ID
    const id = `student_${Math.random().toString(36).substring(2, 9)}`
    setStudentIdentifier(id)
  }, [])

  useEffect(() => {
    if (!params.examCode || !studentIdentifier) return

    async function fetchExamAndStartSession() {
      setIsLoading(true)
      setError(null)

      const { data: examData, error: examError } = await supabase
        .from("exams")
        .select(`
    id, 
    title, 
    description, 
    start_time, 
    duration_minutes,
    questions (
      id, 
      question_text, 
      type, 
      options, 
      teacher_attachment_url, 
      teacher_attachment_filename, 
      points
    )
  `)
        .eq("exam_code", params.examCode.toUpperCase())
        .single()

      if (examError || !examData) {
        setError("Failed to load exam details or exam not found.")
        setIsLoading(false)
        return
      }

      if (examData && examData.questions) {
        // Sort questions by their order (you might need to add sort_order to the select)
        examData.questions.sort((a: any, b: any) => {
          // If you have sort_order field, use it, otherwise maintain array order
          return 0
        })
      }

      // Check if exam has a specific start time and if it's passed
      if (examData.start_time) {
        const examStartTime = new Date(examData.start_time).getTime()
        const now = new Date().getTime()
        if (now < examStartTime) {
          setError(
            `This exam is scheduled to start at ${new Date(examData.start_time).toLocaleString()}. Please check back later.`,
          )
          setIsLoading(false)
          return
        }
      }

      // Start or resume session
      const { data: sessionData, error: sessionError } = await supabase
        .from("student_exam_sessions")
        .upsert(
          { exam_id: examData.id, student_identifier: studentIdentifier, status: "started" },
          { onConflict: "exam_id, student_identifier", ignoreDuplicates: false },
        )
        .select("id, status, join_time")
        .single()

      if (sessionError || !sessionData) {
        setError("Failed to start or resume exam session.")
        console.error("Session error:", sessionError)
        setIsLoading(false)
        return
      }
      setSessionId(sessionData.id)

      if (sessionData.status === "submitted" || sessionData.status === "timed_out") {
        setExamFinishedMessage(
          `You have already ${sessionData.status === "submitted" ? "submitted" : "timed out of"} this exam.`,
        )
        setIsLoading(false)
        return
      }

      setExamDetails(examData as ExamDetails)

      // Calculate time left
      const examStartTimeForTimer = sessionData.join_time
        ? new Date(sessionData.join_time).getTime()
        : new Date().getTime()
      const examEndTime = examStartTimeForTimer + examData.duration_minutes * 60 * 1000
      const now = new Date().getTime()
      const remaining = Math.max(0, Math.floor((examEndTime - now) / 1000))
      setTimeLeft(remaining)

      setIsLoading(false)
    }

    fetchExamAndStartSession()
  }, [params.examCode, supabase, studentIdentifier])

  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) {
      handleAutoSubmit("Time's up! Your exam is being submitted automatically.")
      return
    }
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime !== null ? Math.max(0, prevTime - 1) : 0))
    }, 1000)
    return () => clearInterval(timerId)
  }, [timeLeft])

  const handleAnswerChange = (questionId: string, value: any, type: Question["type"]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        ...(type === "text" && { answer_text: value }),
        ...(type === "multiple_choice" && { selected_option_index: Number.parseInt(value, 10) }),
        ...(type === "file_upload" && { answer_file: value as File }),
      },
    }))
  }

  const handleNextQuestion = () => {
    if (examDetails && currentQuestionIndex < examDetails.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const submitExam = async (reason = "Exam submitted successfully!") => {
    if (!examDetails || !sessionId || isSubmitting || examFinishedMessage) return
    setIsSubmitting(true)
    setError(null)

    const submissionsToInsert = Object.values(answers).map((ans) => ({
      session_id: sessionId,
      question_id: ans.question_id,
      answer_text: ans.answer_text,
      selected_option_index: ans.selected_option_index,
      // File upload handling would be more complex: upload to storage, then save URL
      // For now, skipping direct file content in this part of submission
    }))

    if (submissionsToInsert.length > 0) {
      const { error: submissionError } = await supabase.from("submissions").insert(submissionsToInsert)

      if (submissionError) {
        setError("Failed to save some answers. Please try again or contact support.")
        console.error("Submission error:", submissionError)
        setIsSubmitting(false)
        return
      }
    }

    // Handle file uploads separately
    for (const answer of Object.values(answers)) {
      if (answer.answer_file && answer.question_id) {
        const file = answer.answer_file
        const filePath = `${studentIdentifier}/${examDetails.id}/${answer.question_id}/${file.name}`
        const { error: uploadError } = await supabase.storage
          .from("exam_files") // Ensure this bucket exists and has correct policies
          .upload(filePath, file)

        if (uploadError) {
          setError(`Failed to upload file for one of the questions: ${uploadError.message}`)
          // Continue submitting other answers if possible, or decide to halt
        } else {
          // Update submission with file URL
          const { data: publicUrlData } = supabase.storage.from("exam_files").getPublicUrl(filePath)
          if (publicUrlData) {
            await supabase
              .from("submissions")
              .update({ answer_file_url: publicUrlData.publicUrl, answer_file_filename: file.name })
              .eq("session_id", sessionId)
              .eq("question_id", answer.question_id)
          }
        }
      }
    }

    const { error: sessionUpdateError } = await supabase
      .from("student_exam_sessions")
      .update({ status: timeLeft !== null && timeLeft <= 0 ? "timed_out" : "submitted" })
      .eq("id", sessionId)

    if (sessionUpdateError) {
      // Log this, but the exam is mostly submitted.
      console.error("Failed to update session status:", sessionUpdateError)
    }

    setExamFinishedMessage(reason)
    setIsSubmitting(false)
    setTimeLeft(0) // Stop timer
  }

  const handleAutoSubmit = (message: string) => {
    if (!examFinishedMessage) {
      // Prevent multiple auto-submits
      submitExam(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-12 h-12 animate-spin text-sky-600" />
        <p className="mt-4 text-lg">Loading exam...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="mt-4 text-lg text-red-600">{error}</p>
        <Button onClick={() => (window.location.href = "/")} className="mt-6">
          Go to Homepage
        </Button>
      </div>
    )
  }

  if (examFinishedMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="mt-6 text-2xl font-semibold">{examFinishedMessage}</h2>
        <p className="mt-2 text-muted-foreground">Your responses have been recorded.</p>
        <Button onClick={() => (window.location.href = "/")} className="mt-8">
          Return to Homepage
        </Button>
      </div>
    )
  }

  if (!examDetails || examDetails.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-12 h-12 text-yellow-500" />
        <p className="mt-4 text-lg">No questions found for this exam or exam is not available.</p>
        <Button onClick={() => (window.location.href = "/")} className="mt-6">
          Go to Homepage
        </Button>
      </div>
    )
  }

  const currentQuestion = examDetails.questions[currentQuestionIndex]
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "00:00:00"
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0")
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${h}:${m}:${s}`
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">{examDetails.title}</CardTitle>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800">
              <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span className="text-lg font-medium tabular-nums text-sky-700 dark:text-sky-300">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          {examDetails.description && <CardDescription className="mt-1">{examDetails.description}</CardDescription>}
        </CardHeader>

        <CardContent className="py-6">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {examDetails.questions.length}
              <span className="mx-2">|</span>
              Points: {currentQuestion.points}
            </p>
            <h3 className="text-xl font-semibold mt-1">{currentQuestion.question_text}</h3>
            {currentQuestion.teacher_attachment_url && (
              <div className="mt-3 p-3 border rounded-md bg-slate-50 dark:bg-slate-800">
                <p className="text-sm font-medium mb-1">Attachment:</p>
                <a
                  href={currentQuestion.teacher_attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline dark:text-sky-400"
                >
                  {currentQuestion.teacher_attachment_filename || "View Attached File"}
                </a>
              </div>
            )}
          </div>

          {currentQuestion.type === "text" && (
            <Textarea
              placeholder="Type your answer here..."
              rows={5}
              value={answers[currentQuestion.id]?.answer_text || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value, "text")}
              className="text-base"
            />
          )}

          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id]?.selected_option_index?.toString()}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value, "multiple_choice")}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <Label
                  key={index}
                  htmlFor={`q${currentQuestion.id}-opt${index}`}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${answers[currentQuestion.id]?.selected_option_index === index ? "bg-sky-50 dark:bg-sky-900 border-sky-500" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <RadioGroupItem value={index.toString()} id={`q${currentQuestion.id}-opt${index}`} className="mr-3" />
                  <span className="text-base">{option.text}</span>
                </Label>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === "file_upload" && (
            <div>
              <Label htmlFor={`file-upload-${currentQuestion.id}`} className="block mb-2 text-sm font-medium">
                Upload your file:
              </Label>
              <Input
                id={`file-upload-${currentQuestion.id}`}
                type="file"
                onChange={(e) =>
                  handleAnswerChange(currentQuestion.id, e.target.files ? e.target.files[0] : null, "file_upload")
                }
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 dark:file:bg-sky-700 dark:file:text-sky-100 dark:hover:file:bg-sky-600"
              />
              {answers[currentQuestion.id]?.answer_file && (
                <p className="mt-2 text-sm text-green-600">
                  Selected file: {(answers[currentQuestion.id]?.answer_file as File).name}
                </p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 || isSubmitting}
              className="flex-1 sm:flex-none"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex === examDetails.questions.length - 1 || isSubmitting}
              className="flex-1 sm:flex-none"
            >
              Next
            </Button>
          </div>
          {currentQuestionIndex === examDetails.questions.length - 1 ? (
            <Button
              onClick={() => submitExam("Exam submitted successfully!")}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Submit Exam
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={true} /* This button is effectively replaced by Next/Submit logic */
              className="w-full sm:w-auto invisible sm:visible"
            >
              {/* Placeholder for alignment */}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
