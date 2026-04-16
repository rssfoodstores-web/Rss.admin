import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSafeNextPath } from "@/lib/auth-redirects"
import { getServerAdminSiteUrl } from "@/lib/site-url"

function buildErrorRedirect(origin: string, message: string, description?: string | null) {
    const url = new URL("/auth/auth-code-error", `${origin}/`)
    url.searchParams.set("error", message)
    url.searchParams.set("callback_url", `${origin}/auth/callback`)

    if (description) {
        url.searchParams.set("error_description", description)
    }

    return NextResponse.redirect(url)
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const origin = getServerAdminSiteUrl(request)
    const next = getSafeNextPath(searchParams.get("next")) ?? "/dashboard"
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return buildErrorRedirect(
            origin,
            "Missing authenticated session",
            "Admin sign-in finished, but no authenticated user session was found."
        )
    }

    return NextResponse.redirect(`${origin}${next}`)
}
