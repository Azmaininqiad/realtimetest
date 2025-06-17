// Page for creating a new exam
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Trash2, Wand2, Loader2, UploadCloud, FileText, ListChecks, AlertTriangle } from "lucide-react"
import { createExamAction, generateQuestionWithAI } from "./actions" // Server actions
import { useToast } from "@/components/ui/use-toast" // Assuming you have a toast hook

type QuestionOption = {
  text: string
  is_correct: boolean
}

type QuestionState = {
  id: string // temporary client-side ID
  question_text: string
  type: "text" | "multiple_choice" | "file_upload"
  options: QuestionOption[]
  teacher_attachment?: File | null // For teacher uploading a file with the question
  points: number
}

export default function CreateExamPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [startTime, setStartTime] = useState<string>("") // Optional start time
  const [questions, setQuestions] = useState<QuestionState[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiLoadingQuestionIndex, setAiLoadingQuestionIndex] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `temp-${Date.now()}`, // Simple unique ID for client-side key
        question_text: "",
        type: "text",
        options: [
          { text: "", is_correct: false },
          { text: "", is_correct: false },
        ], // Default for MCQ
        teacher_attachment: null,
        points: 10,
      },
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleQuestionChange = (index: number, field: keyof QuestionState, value: any) => {
    const newQuestions = [...questions]
    if (field === "points") {
      newQuestions[index] = { ...newQuestions[index], [field]: Number.parseInt(value, 10) || 0 }
    } else if (field === "teacher_attachment") {
      newQuestions[index] = { ...newQuestions[index], [field]: value as File | null }
    } else {
      newQuestions[index] = { ...newQuestions[index], [field]: value }
    }
    setQuestions(newQuestions)
  }

  const handleOptionChange = (
    qIndex: number,
    optIndex: number,
    field: keyof QuestionOption,
    value: string | boolean,
  ) => {
    const newQuestions = [...questions]
    const newOptions = [...newQuestions[qIndex].options]
    newOptions[optIndex] = { ...newOptions[optIndex], [field]: value }
    newQuestions[qIndex].options = newOptions
    setQuestions(newQuestions)
  }

  const addOption = (qIndex: number) => {
    const newQuestions = [...questions]
    newQuestions[qIndex].options.push({ text: "", is_correct: false })
    setQuestions(newQuestions)
  }

  const removeOption = (qIndex: number, optIndex: number) => {
    const newQuestions = [...questions]
    newQuestions[qIndex].options = newQuestions[qIndex].options.filter((_, i) => i !== optIndex)
    setQuestions(newQuestions)
  }

  const handleGenerateAIQuestion = async (index: number) => {
    setAiLoadingQuestionIndex(index)
    const currentQuestionText = questions[index].question_text // Use existing text as context if any
    const topic = currentQuestionText || title || "a general knowledge topic" // Fallback topic

    try {
      const result = await generateQuestionWithAI(topic, questions[index].type)
      if (result.error) {
        toast({ title: "AI Generation Failed", description: result.error, variant: "destructive" })
      } else if (result.generatedQuestion) {
        const newQuestions = [...questions]
        newQuestions[index].question_text = result.generatedQuestion.question_text
        if (result.generatedQuestion.options && newQuestions[index].type === "multiple_choice") {
          newQuestions[index].options = result.generatedQuestion.options.map((opt) => ({
            text: opt.text,
            is_correct: opt.is_correct || false,
          }))
        }
        setQuestions(newQuestions)
        toast({ title: "AI Question Generated!", description: "Review and adjust as needed." })
      }
    } catch (e) {
      toast({ title: "AI Generation Error", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setAiLoadingQuestionIndex(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    if (!title.trim()) {
      setFormError("Exam title is required.")
      setIsSubmitting(false)
      return
    }
    if (durationMinutes <= 0) {
      setFormError("Duration must be a positive number.")
      setIsSubmitting(false)
      return
    }
    if (questions.length === 0) {
      setFormError("Please add at least one question.")
      setIsSubmitting(false)
      return
    }

    for (const q of questions) {
      if (!q.question_text.trim()) {
        setFormError(`Question "${q.id}" text cannot be empty.`)
        setIsSubmitting(false)
        return
      }
      if (q.type === "multiple_choice") {
        if (q.options.length < 2) {
          setFormError(`Question "${q.question_text || q.id}" (Multiple Choice) must have at least two options.`)
          setIsSubmitting(false)
          return
        }
        if (!q.options.some((opt) => opt.is_correct)) {
          setFormError(`Question "${q.question_text || q.id}" (Multiple Choice) must have at least one correct option.`)
          setIsSubmitting(false)
          return
        }
        for (const opt of q.options) {
          if (!opt.text.trim()) {
            setFormError(`An option in question "${q.question_text || q.id}" is empty.`)
            setIsSubmitting(false)
            return
          }
        }
      }
    }

    const formData = new FormData()
    formData.append("title", title)
    formData.append("description", description)
    formData.append("durationMinutes", durationMinutes.toString())
    if (startTime) formData.append("startTime", startTime)

    // Append question data and files
    questions.forEach((q, index) => {
      formData.append(`questions[${index}][question_text]`, q.question_text)
      formData.append(`questions[${index}][type]`, q.type)
      formData.append(`questions[${index}][points]`, q.points.toString())
      if (q.type === "multiple_choice") {
        formData.append(`questions[${index}][options]`, JSON.stringify(q.options))
      }
      if (q.teacher_attachment) {
        formData.append(`question_attachment_${index}`, q.teacher_attachment)
      }
    })

    try {
      const result = await createExamAction(formData)
      if (result.error) {
        setFormError(result.error)
        toast({ title: "Error Creating Exam", description: result.error, variant: "destructive" })
      } else if (result.examCode) {
        toast({ title: "Exam Created Successfully!", description: `Exam Code: ${result.examCode}` })
        router.push(`/host/exam-created?code=${result.examCode}&title=${encodeURIComponent(title)}`)
      }
    } catch (e: any) {
      setFormError("An unexpected error occurred. " + e.message)
      toast({ title: "Submission Failed", description: e.message || "Please try again.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Set min attribute for datetime-local input to prevent past dates
  const [minDateTime, setMinDateTime] = useState("")
  useEffect(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) // Adjust for local timezone
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const HH = String(now.getHours()).padStart(2, "0")
    const MM = String(now.getMinutes()).padStart(2, "0")
    setMinDateTime(`${yyyy}-${mm}-${dd}T${HH}:${MM}`)
  }, [])

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Create New Exam</CardTitle>
          <CardDescription>Fill in the details below to set up your exam.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg font-medium">
                Exam Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Midterm Physics Test"
                required
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-lg font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a brief overview or instructions for the exam."
                className="text-base"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="durationMinutes" className="text-lg font-medium">
                  Duration (Minutes)
                </Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value, 10))}
                  required
                  min="1"
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-lg font-medium">
                  Specific Start Time (Optional)
                </Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  min={minDateTime}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  If not set, students can start immediately after joining with the code (once exam is active).
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 border-b pb-2">Questions</h3>
              {questions.map((q, qIndex) => (
                <Card key={q.id} className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-2 sm:p-4">
                  <CardHeader className="p-2 sm:p-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Question {qIndex + 1}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGenerateAIQuestion(qIndex)}
                          disabled={aiLoadingQuestionIndex === qIndex}
                          title="Generate with AI"
                        >
                          {aiLoadingQuestionIndex === qIndex ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Wand2 className="h-5 w-5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(qIndex)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-2 sm:p-4">
                    <Textarea
                      placeholder="Enter question text..."
                      value={q.question_text}
                      onChange={(e) => handleQuestionChange(qIndex, "question_text", e.target.value)}
                      required
                      rows={3}
                      className="text-base"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`q-${qIndex}-type`} className="block mb-1 text-sm">
                          Question Type
                        </Label>
                        <Select
                          value={q.type}
                          onValueChange={(value) =>
                            handleQuestionChange(qIndex, "type", value as QuestionState["type"])
                          }
                        >
                          <SelectTrigger id={`q-${qIndex}-type`}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">
                              <FileText className="inline-block mr-2 h-4 w-4" />
                              Text Answer
                            </SelectItem>
                            <SelectItem value="multiple_choice">
                              <ListChecks className="inline-block mr-2 h-4 w-4" />
                              Multiple Choice
                            </SelectItem>
                            <SelectItem value="file_upload">
                              <UploadCloud className="inline-block mr-2 h-4 w-4" />
                              File Upload
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`q-${qIndex}-points`} className="block mb-1 text-sm">
                          Points
                        </Label>
                        <Input
                          id={`q-${qIndex}-points`}
                          type="number"
                          value={q.points}
                          onChange={(e) => handleQuestionChange(qIndex, "points", e.target.value)}
                          min="0"
                          className="text-base"
                        />
                      </div>
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="space-y-3 mt-3">
                        <Label className="block text-sm font-medium">Options (Mark correct answer)</Label>
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder={`Option ${optIndex + 1}`}
                              value={opt.text}
                              onChange={(e) => handleOptionChange(qIndex, optIndex, "text", e.target.value)}
                              required
                              className="flex-grow text-sm"
                            />
                            <input
                              type="checkbox"
                              id={`q-${qIndex}-opt-${optIndex}-correct`}
                              checked={opt.is_correct}
                              onChange={(e) => handleOptionChange(qIndex, optIndex, "is_correct", e.target.checked)}
                              className="form-checkbox h-5 w-5 text-sky-600 rounded focus:ring-sky-500"
                              title="Mark as correct"
                            />
                            <Label htmlFor={`q-${qIndex}-opt-${optIndex}-correct`} className="sr-only">
                              Correct
                            </Label>
                            {q.options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(qIndex, optIndex)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => addOption(qIndex)}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                        </Button>
                      </div>
                    )}
                    {q.type === "file_upload" && (
                      <div className="mt-3">
                        <Label htmlFor={`q-${qIndex}-attachment`} className="block text-sm font-medium">
                          Teacher Attachment (Optional)
                        </Label>
                        <Input
                          id={`q-${qIndex}-attachment`}
                          type="file"
                          onChange={(e) =>
                            handleQuestionChange(
                              qIndex,
                              "teacher_attachment",
                              e.target.files ? e.target.files[0] : null,
                            )
                          }
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 dark:file:bg-sky-700 dark:file:text-sky-100 dark:hover:file:bg-sky-600"
                        />
                        {q.teacher_attachment && (
                          <p className="text-xs text-muted-foreground mt-1">Selected: {q.teacher_attachment.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          If the question refers to an image or document, upload it here.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
                className="w-full border-dashed hover:border-solid"
              >
                <PlusCircle className="mr-2 h-5 w-5" /> Add Question
              </Button>
            </div>
            {formError && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p>{formError}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {isSubmitting ? "Creating Exam..." : "Create Exam"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
