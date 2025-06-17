"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Copy, Home } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function ExamCreatedPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const examCode = searchParams.get("code")
  const examTitle = searchParams.get("title")

  if (!examCode || !examTitle) {
    // Redirect or show error if params are missing
    // This could happen if user navigates here directly
    if (typeof window !== "undefined") {
      // Ensure this runs client-side
      router.replace("/host/create-exam")
    }
    return <div className="flex items-center justify-center min-h-screen">Loading or redirecting...</div>
  }

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(examCode)
      .then(() => {
        toast({
          title: "Copied to clipboard!",
          description: `Exam code ${examCode} is now in your clipboard.`,
        })
      })
      .catch((err) => {
        toast({
          title: "Failed to copy",
          description: "Could not copy code to clipboard.",
          variant: "destructive",
        })
      })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-sky-100 dark:from-slate-900 dark:to-sky-900 p-4">
      <Card className="w-full max-w-md shadow-2xl text-center">
        <CardHeader>
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-800 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-bold">Exam Created Successfully!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Your exam "{decodeURIComponent(examTitle)}" is ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-base">Share this code with your students to join the exam:</p>
          <div className="p-4 border-2 border-dashed border-sky-400 dark:border-sky-600 rounded-lg bg-sky-50 dark:bg-sky-800/30">
            <span className="text-4xl font-bold tracking-widest text-sky-700 dark:text-sky-300">{examCode}</span>
          </div>
          <Button onClick={copyToClipboard} className="w-full" variant="outline">
            <Copy className="mr-2 h-4 w-4" /> Copy Exam Code
          </Button>
        </CardContent>
        <CardContent className="border-t pt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push("/host/create-exam")} variant="outline" className="w-full sm:w-auto">
            Create Another Exam
          </Button>
          <Button onClick={() => router.push("/")} className="w-full sm:w-auto">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
