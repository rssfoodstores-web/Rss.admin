"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

export const MANUAL_ACCOUNT_ROLES = [
    "customer",
    "merchant",
    "rider",
    "agent",
    "admin",
    "sub_admin",
] as const

export type ManualAccountRole = (typeof MANUAL_ACCOUNT_ROLES)[number]

interface CreateManualAccountInput {
    grantAccountInfoPageAccess?: boolean
    email: string
    fullName?: string
    grantAccountsPageAccess?: boolean
    password: string
    role: ManualAccountRole
}

interface CreateManualAccountResult {
    createdUser?: {
        email: string
        id: string
        role: ManualAccountRole
    }
    error?: string
    success?: true
}

const PRIVILEGED_ROLES = new Set<ManualAccountRole>(["admin", "sub_admin"])

function isManualAccountRole(value: string): value is ManualAccountRole {
    return MANUAL_ACCOUNT_ROLES.includes(value as ManualAccountRole)
}

function normalizeEmail(value: string) {
    return value.trim().toLowerCase()
}

function getFallbackName(email: string) {
    return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || email
}

async function cleanupCreatedAuthUser(userId: string) {
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
        adminSupabase = createAdminClient()
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : "Supabase admin credentials are not configured.",
        }
    }

    await adminSupabase.from("admin_dashboard_permissions").delete().eq("user_id", userId)
    await adminSupabase.from("user_roles").delete().eq("user_id", userId)
    await adminSupabase.from("profiles").delete().eq("id", userId)
    await adminSupabase.auth.admin.deleteUser(userId)
}

export async function createManualAccount(input: CreateManualAccountInput): Promise<CreateManualAccountResult> {
    const access = await requireAdminRouteAccess("accounts")
    const email = normalizeEmail(input.email)
    const password = input.password.trim()
    const requestedRole = input.role

    if (!email || !email.includes("@")) {
        return { error: "Enter a valid email address." }
    }

    if (password.length < 6) {
        return { error: "Password must be at least 6 characters." }
    }

    if (!isManualAccountRole(requestedRole)) {
        return { error: "Select a valid account role." }
    }

    if (PRIVILEGED_ROLES.has(requestedRole) && access.primaryRole === "sub_admin") {
        return { error: "Sub-admins cannot create admin or sub-admin accounts." }
    }

    const fullName = input.fullName?.trim() || getFallbackName(email)
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
        adminSupabase = createAdminClient()
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : "Supabase admin credentials are not configured.",
        }
    }

    const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: {
            full_name: fullName,
        },
    })

    if (createError || !created.user) {
        return {
            error: createError?.message ?? "Supabase did not return the created user.",
        }
    }

    const userId = created.user.id
    const { error: profileError } = await adminSupabase
        .from("profiles")
        .upsert(
            {
                full_name: fullName,
                id: userId,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "id",
            }
        )

    if (profileError) {
        await cleanupCreatedAuthUser(userId)
        return { error: profileError.message }
    }

    const { error: roleError } = await adminSupabase
        .from("user_roles")
        .insert({
            role: requestedRole,
            user_id: userId,
        })

    if (roleError) {
        await cleanupCreatedAuthUser(userId)
        return { error: roleError.message }
    }

    const subAdminPermissionKeys = [
        input.grantAccountsPageAccess === true ? "accounts" : null,
        input.grantAccountInfoPageAccess === true ? "account_info" : null,
    ].filter((permissionKey): permissionKey is "accounts" | "account_info" => Boolean(permissionKey))

    if (requestedRole === "sub_admin" && subAdminPermissionKeys.length > 0) {
        const { error: permissionError } = await adminSupabase
            .from("admin_dashboard_permissions")
            .insert(
                subAdminPermissionKeys.map((permissionKey) => ({
                    granted_by: access.user.id,
                    permission_key: permissionKey,
                    user_id: userId,
                }))
            )

        if (permissionError) {
            await cleanupCreatedAuthUser(userId)
            return { error: permissionError.message }
        }
    }

    await adminSupabase.from("audit_logs").insert({
        action: "create_manual_account",
        actor_id: access.user.id,
        actor_role: access.primaryRole,
        entity_id: userId,
        entity_type: "auth_user",
        metadata: {
            email,
            full_name: fullName,
            granted_permission_keys: requestedRole === "sub_admin" ? subAdminPermissionKeys : [],
            role: requestedRole,
        },
    })

    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/account-info")
    revalidatePath("/dashboard/admins")
    revalidatePath("/dashboard")

    return {
        createdUser: {
            email,
            id: userId,
            role: requestedRole,
        },
        success: true,
    }
}
