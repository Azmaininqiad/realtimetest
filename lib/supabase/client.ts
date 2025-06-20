import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Ensure these are set in your environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or Anon Key is missing from environment variables.")
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
