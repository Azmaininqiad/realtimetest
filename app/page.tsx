import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BookOpenCheck, Users } from "lucide-react"
import { joinExamAction } from "./actions"

// Add this component to handle search params
function ErrorDisplay() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const error = searchParams.get("error")
  const startTime = searchParams.get("start")

  if (!error) return null

  let errorMessage = ""
  switch (error) {
    case "invalid-code":
      errorMessage = "Invalid exam code format. Please enter a 6-character code."
      break
    case "not-found":
      errorMessage = "Exam not found. Please check the code and try again."
      break
    case "not-started":
      errorMessage = startTime
        ? `This exam is scheduled to start at ${new Date(startTime).toLocaleString()}.`
        : "This exam has not started yet."
      break
    default:
      errorMessage = "An error occurred. Please try again."
  }

  return <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">{errorMessage}</div>
}

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 to-sky-100 dark:from-slate-900 dark:to-sky-900">
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Interactive Examination Platform
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          Host engaging exams with time limits and diverse question types, or join an exam seamlessly using a code.
        </p>
      </header>

      <ErrorDisplay />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <BookOpenCheck className="w-8 h-8 text-sky-600 dark:text-sky-400" />
              <CardTitle className="text-2xl font-semibold">Host an Exam</CardTitle>
            </div>
            <CardDescription>
              Create a new exam, add questions, set time limits, and share the unique exam code with participants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ready to design your assessment? Click below to get started.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full bg-sky-600 hover:bg-sky-700 text-white">
              <Link href="/host/create-exam">Create New Exam</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-2xl font-semibold">Join an Exam</CardTitle>
            </div>
            <CardDescription>
              Have an exam code? Enter it here to start your assessment. Make sure you're ready before you begin!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={joinExamAction} className="space-y-4">
              <div>
                <Label htmlFor="examCode" className="sr-only">
                  Exam Code
                </Label>
                <Input
                  id="examCode"
                  name="examCode"
                  placeholder="Enter Exam Code (e.g., AB12CD)"
                  className="text-center text-lg tracking-wider"
                  required
                  pattern="[A-Za-z0-9]{6}"
                  title="Exam code should be 6 alphanumeric characters."
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Join Exam
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
              Ensure you have a stable internet connection before joining.
            </p>
          </CardFooter>
        </Card>
      </div>
      <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} Examination Platform. All rights reserved.</p>
      </footer>
    </div>
  )
}
