"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { buildAbsoluteUrl, getClientAdminSiteUrl } from "@/lib/site-url"

function buildAuthErrorUrl(message: string, description: string) {
    return buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/auth-code-error", {
        error: message,
        error_code: "session_exchange_failed",
        error_description: description,
        callback_url: buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/callback"),
    })
}

export function AuthCallbackFallbackClient({
    code,
    nextPath,
}: {
    code: string | null
    nextPath: string
}) {
    const [statusMessage, setStatusMessage] = useState("Completing admin sign-in...")

    useEffect(() => {
        let cancelled = false
        let timeoutId: number | null = null

        const finalizeWithActiveSession = async () => {
            const supabase = createClient()
            const {
                data: { session },
            } = await supabase.auth.getSession()

            if (!session) {
                return false
            }

            if (cancelled) {
                return true
            }

            setStatusMessage("Finalizing your admin session...")

            window.location.assign(
                buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/callback/finalize", {
                    next: nextPath,
                })
            )

            return true
        }

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
                if (await finalizeWithActiveSession()) {
                    return
                }

                const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
                    if (!session || cancelled) {
                        return
                    }

                    setStatusMessage("Finalizing your admin session...")

                    window.location.assign(
                        buildAbsoluteUrl(getClientAdminSiteUrl(), "/auth/callback/finalize", {
                            next: nextPath,
                        })
                    )
                })

                timeoutId = window.setTimeout(async () => {
                    const resolved = await finalizeWithActiveSession()

                    if (resolved || cancelled) {
                        listener.subscription.unsubscribe()
                        return
                    }

                    listener.subscription.unsubscribe()
                    window.location.assign(
                        buildAuthErrorUrl(
                            "PKCE code verifier not found in storage.",
                            "Admin sign-in could not be completed because the browser did not retain the PKCE verifier for this login attempt."
                        )
                    )
                }, 4000)
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
            if (timeoutId) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [code, nextPath])

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
