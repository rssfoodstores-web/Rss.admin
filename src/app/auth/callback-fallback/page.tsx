"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getSafeNextPath } from "@/lib/auth-redirects"
import { buildAbsoluteUrl, getClientAdminSiteUrl } from "@/lib/site-url"

function buildAuthErrorUrl(message: string, description: string) {
    return buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/auth-code-error", {
        error: message,
        error_code: "session_exchange_failed",
        error_description: description,
        callback_url: buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/callback"),
    })
}

export default function AuthCallbackFallbackPage() {
    const searchParams = useSearchParams()
    const [statusMessage, setStatusMessage] = useState("Completing admin sign-in...")

    const code = searchParams.get("code")
    const next = useMemo(
        () => getSafeNextPath(searchParams.get("next")) ?? "/dashboard",
        [searchParams]
    )

    useEffect(() => {
        let cancelled = false

        const completeAuth = async () => {
            if (!code) {
                window.location.assign(
                    buildAuthErrorUrl(
                        "Missing auth code",
                        "Supabase did not return an authorization code."
                    )
                )
                return
            }

            try {
                const supabase = createClient()
                const { error } = await supabase.auth.exchangeCodeForSession(code)

                if (error) {
                    window.location.assign(
                        buildAuthErrorUrl(
                            error.message,
                            "Admin sign-in could not be completed in the browser fallback flow."
                        )
                    )
                    return
                }

                if (cancelled) {
                    return
                }

                setStatusMessage("Finalizing your admin session...")

                window.location.assign(
                    buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/callback/finalize", {
                        next,
                    })
                )
            } catch (error) {
                console.error("Client auth callback fallback failed:", error)
                window.location.assign(
                    buildAuthErrorUrl(
                        "Authentication fallback failed",
                        "Admin sign-in started, but the callback could not be completed."
                    )
                )
            }
        }

        void completeAuth()

        return () => {
            cancelled = true
        }
    }, [code, next])

    return (
        <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
                <div className="w-full rounded-3xl border border-border bg-card px-8 py-12 text-center shadow-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <h1 className="mt-6 text-2xl font-extrabold text-foreground">
                        Signing you in
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        {statusMessage}
                    </p>
                </div>
            </div>
        </div>
    )
}
