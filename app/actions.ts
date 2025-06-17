"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function joinExamAction(formData: FormData) {
  const examCode = formData.get("examCode") as string

  if (!examCode || typeof examCode !== "string" || !/^[A-Za-z0-9]{6}$/.test(examCode.trim())) {
    redirect("/?error=invalid-code")
  }

  const supabase = createSupabaseServerClient()
  const codeToSearch = examCode.trim().toUpperCase()

  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, title, start_time, duration_minutes")
    .eq("exam_code", codeToSearch)
    .single()

  if (error || !exam) {
    console.error("Error fetching exam or exam not found:", error)
    redirect("/?error=not-found")
  }

  // Basic check if exam can be joined
  if (exam.start_time) {
    const examStartTime = new Date(exam.start_time).getTime()
    const now = new Date().getTime()
    if (now < examStartTime) {
      redirect(`/?error=not-started&start=${encodeURIComponent(exam.start_time)}`)
    }
  }

  redirect(`/exam/${codeToSearch}/take`)
}
