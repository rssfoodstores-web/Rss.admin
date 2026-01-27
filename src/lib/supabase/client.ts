import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        "https://anwsrfzhjbhgskdzxolr.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFud3NyZnpoamJoZ3NrZHp4b2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMTk1MDQsImV4cCI6MjA4MzU5NTUwNH0.pPm49bcF0-ABiJLsMa3yldWFRCCMvzO1jwPycbtvSzc"
    )
}
