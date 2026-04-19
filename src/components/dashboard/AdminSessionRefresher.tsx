"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const ADMIN_ROLES = new Set(["admin", "sub_admin", "supa_admin"])

function normalizeRoles(value: string[] | null | undefined) {
    return Array.from(
        new Set(
            (value ?? [])
                .map((role) => role.trim())
                .filter((role) => role.length > 0)
        )
    )
}

export function AdminSessionRefresher({
    expectedRoles,
    jwtRoles,
}: {
    expectedRoles: string[]
    jwtRoles: string[]
}) {
    const router = useRouter()

    useEffect(() => {
        const normalizedExpectedRoles = normalizeRoles(expectedRoles)
        const normalizedJwtRoles = new Set(normalizeRoles(jwtRoles))
        const expectsAdminAccess = normalizedExpectedRoles.some((role) => ADMIN_ROLES.has(role))
        const hasRoleMismatch = normalizedExpectedRoles.some((role) => ADMIN_ROLES.has(role) && !normalizedJwtRoles.has(role))

        if (!expectsAdminAccess || !hasRoleMismatch) {
            return
        }

        let cancelled = false

        const syncAdminSession = async () => {
            const supabase = createClient()
            const { error } = await supabase.auth.refreshSession()

            if (cancelled) {
                return
            }

            if (error) {
                console.error("Unable to refresh admin session roles:", error)
                return
            }

            router.refresh()
        }

        void syncAdminSession()

        return () => {
            cancelled = true
        }
    }, [expectedRoles, jwtRoles, router])

    return null
}
