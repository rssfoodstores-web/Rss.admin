"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client"
const DEFAULT_GOOGLE_CLIENT_ID = "893481018026-md35nskbii34k42d8rj0nugan5l9ekog.apps.googleusercontent.com"

type GoogleButtonText = "signin_with" | "signup_with"

interface GoogleCredentialResponse {
    credential?: string
}

interface GoogleIdentityApi {
    initialize(options: {
        callback: (response: GoogleCredentialResponse) => void
        client_id: string
        context: "signin" | "signup"
        nonce: string
        ux_mode: "popup"
    }): void
    renderButton(
        parent: HTMLElement,
        options: {
            logo_alignment: "left"
            shape: "pill"
            size: "large"
            text: GoogleButtonText
            theme: "filled_black" | "outline"
            type: "standard"
            width: number
        }
    ): void
}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: GoogleIdentityApi
            }
        }
    }
}

interface GoogleIdentityButtonProps {
    className?: string
    disabled?: boolean
    onAuthenticated: (userId: string) => void | Promise<void>
    onError: (message: string) => void
    text?: GoogleButtonText
}

async function createNonce() {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    const raw = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    const encoded = new TextEncoder().encode(raw)
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
    const hashed = Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("")

    return { hashed, raw }
}

export function GoogleIdentityButton({
    className,
    disabled = false,
    onAuthenticated,
    onError,
    text = "signin_with",
}: GoogleIdentityButtonProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const buttonRef = useRef<HTMLDivElement | null>(null)
    const nonceRef = useRef<string | null>(null)
    const onAuthenticatedRef = useRef(onAuthenticated)
    const onErrorRef = useRef(onError)
    const signingInRef = useRef(false)
    const [scriptReady, setScriptReady] = useState(false)
    const [buttonReady, setButtonReady] = useState(false)
    const [signingIn, setSigningIn] = useState(false)

    useEffect(() => {
        onAuthenticatedRef.current = onAuthenticated
        onErrorRef.current = onError
    }, [onAuthenticated, onError])

    const handleCredential = useCallback(async (response: GoogleCredentialResponse) => {
        if (signingInRef.current) {
            return
        }

        if (!response.credential || !nonceRef.current) {
            onErrorRef.current("Google sign-in could not be completed. Please try again.")
            return
        }

        signingInRef.current = true
        setSigningIn(true)

        try {
            const supabase = createClient()
            const { data, error } = await supabase.auth.signInWithIdToken({
                nonce: nonceRef.current,
                provider: "google",
                token: response.credential,
            })

            if (error || !data.user) {
                console.error("Google ID-token sign-in failed:", error)
                onErrorRef.current("Google sign-in could not be completed. Please try again.")
                return
            }

            await onAuthenticatedRef.current(data.user.id)
        } catch (error) {
            console.error("Unexpected Google sign-in failure:", error)
            onErrorRef.current("Google sign-in is unavailable right now. Please try again shortly.")
        } finally {
            signingInRef.current = false
            setSigningIn(false)
        }
    }, [])

    useEffect(() => {
        if (!scriptReady || !window.google?.accounts.id || !containerRef.current || !buttonRef.current) {
            return
        }

        let cancelled = false
        let resizeObserver: ResizeObserver | null = null
        let themeObserver: MutationObserver | null = null

        const renderGoogleButton = () => {
            const googleIdentity = window.google?.accounts.id
            const container = containerRef.current
            const button = buttonRef.current

            if (!googleIdentity || !container || !button) {
                return
            }

            const width = Math.min(400, Math.max(200, Math.floor(container.getBoundingClientRect().width)))
            button.replaceChildren()
            googleIdentity.renderButton(button, {
                logo_alignment: "left",
                shape: "pill",
                size: "large",
                text,
                theme: document.documentElement.classList.contains("dark") ? "filled_black" : "outline",
                type: "standard",
                width,
            })
            setButtonReady(true)
        }

        const initialize = async () => {
            const { hashed, raw } = await createNonce()

            if (cancelled || !window.google?.accounts.id) {
                return
            }

            nonceRef.current = raw
            window.google.accounts.id.initialize({
                callback: handleCredential,
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID,
                context: text === "signup_with" ? "signup" : "signin",
                nonce: hashed,
                ux_mode: "popup",
            })
            renderGoogleButton()

            resizeObserver = new ResizeObserver(renderGoogleButton)
            resizeObserver.observe(containerRef.current!)
            themeObserver = new MutationObserver(renderGoogleButton)
            themeObserver.observe(document.documentElement, { attributeFilter: ["class"], attributes: true })
        }

        void initialize()

        return () => {
            cancelled = true
            resizeObserver?.disconnect()
            themeObserver?.disconnect()
        }
    }, [handleCredential, scriptReady, text])

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative flex min-h-11 w-full justify-center",
                (disabled || signingIn) && "pointer-events-none opacity-60",
                className
            )}
            aria-busy={signingIn}
        >
            <Script
                src={GOOGLE_IDENTITY_SCRIPT}
                strategy="afterInteractive"
                onReady={() => setScriptReady(true)}
                onError={() => onErrorRef.current("Google sign-in is unavailable right now. Please try again shortly.")}
            />
            <div ref={buttonRef} className={buttonReady ? "flex w-full justify-center" : "hidden"} />
            {!buttonReady ? (
                <div className="flex h-11 w-full items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Google sign-in
                </div>
            ) : null}
        </div>
    )
}
