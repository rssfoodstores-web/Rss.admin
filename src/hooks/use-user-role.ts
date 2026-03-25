"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type AppRole =
    | "customer"
    | "merchant"
    | "rider"
    | "admin"
    | "agent"
    | "supa_admin"
    | "sub_admin"

export function useUserRole() {
    const [role, setRole] = useState<AppRole | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        async function fetchRole() {
            try {
                const supabase = createClient()

                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    setRole(null)
                    return
                }

                const { data, error } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)
                    .single()

                if (error) {
                    // If no role found, default to 'admin' (or handle as restricted)
                    // For now, let's treat missing role as basic admin or log it
                    console.error("Error fetching user role:", error)
                    // Fallback to strict if needed, but for now null or basic admin
                }

                if (data) {
                    setRole(data.role)
                }
            } catch (err) {
                setError(err as Error)
                console.error("Unexpected error in useUserRole:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchRole()
    }, [])

    return { role, loading, error, isSuperAdmin: role === 'supa_admin' }
}
