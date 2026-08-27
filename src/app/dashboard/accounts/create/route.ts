import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { isValidE164PhoneNumber, normalizePhoneNumber } from "@/lib/phone"
import { isManualAccountRole, type ManualAccountRole } from "../roles"

type ManualAccountIdentifierType = "email" | "phone"

interface CreateManualAccountInput {
    grantAccountInfoPageAccess?: boolean
    email?: string
    fullName?: string
    grantAccountsPageAccess?: boolean
    identifierType?: ManualAccountIdentifierType
    password?: string
    passwordGenerated?: boolean
    phone?: string
    role?: string
}

interface CreateManualAccountResult {
    createdUser?: {
        email?: string
        id: string
        identifierType: ManualAccountIdentifierType
        passwordGenerated: boolean
        phone?: string
        role: ManualAccountRole
    }
    error?: string
    success?: true
    warning?: string
}

const PRIVILEGED_ROLES = new Set<ManualAccountRole>(["admin", "sub_admin"])

function normalizeEmail(value: string) {
    return value.trim().toLowerCase()
}

function getFallbackName(email: string) {
    return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || email
}

function getPhoneFallbackName(phone: string) {
    return `Customer ${phone}`
}

async function cleanupCreatedAuthUser(
    adminSupabase: ReturnType<typeof createAdminClient>,
    userId: string
) {
    await adminSupabase.from("admin_dashboard_permissions").delete().eq("user_id", userId)
    await adminSupabase.from("user_roles").delete().eq("user_id", userId)
    await adminSupabase.from("profiles").delete().eq("id", userId)
    await adminSupabase.auth.admin.deleteUser(userId)
}

function json(result: CreateManualAccountResult, status = 200) {
    return NextResponse.json(result, { status })
}

export async function POST(request: Request) {
    const access = await requireAdminRouteAccess("accounts")
    const input = await request.json().catch(() => null) as CreateManualAccountInput | null

    if (!input) {
        return json({ error: "The account request was not valid JSON." }, 400)
    }

    const identifierType = input.identifierType === "phone" ? "phone" : "email"
    const email = normalizeEmail(input.email ?? "")
    const phone = normalizePhoneNumber(input.phone ?? "")
    const password = input.password ?? ""
    const passwordGenerated = input.passwordGenerated === true
    const requestedRole = input.role ?? "customer"

    if (identifierType === "email" && (!email || !email.includes("@"))) {
        return json({ error: "Enter a valid email address." }, 400)
    }

    if (identifierType === "phone" && !isValidE164PhoneNumber(phone)) {
        return json({ error: "Enter a valid phone number." }, 400)
    }

    if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400)
    }

    if (!isManualAccountRole(requestedRole)) {
        return json({ error: "Select a valid account role." }, 400)
    }

    if (PRIVILEGED_ROLES.has(requestedRole) && access.primaryRole === "sub_admin") {
        return json({ error: "Sub-admins cannot create admin or sub-admin accounts." }, 403)
    }

    const fullName = input.fullName?.trim() || (
        identifierType === "phone" ? getPhoneFallbackName(phone) : getFallbackName(email)
    )
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
        adminSupabase = createAdminClient()
    } catch (error) {
        console.error("Admin account service configuration error:", error)
        return json({
            error: "The account service is not configured.",
        }, 500)
    }

    const { data: created, error: createError } = identifierType === "phone"
        ? await adminSupabase.auth.admin.createUser({
            app_metadata: {
                created_role: requestedRole,
                creation_method: "admin_password_account",
                identifier_type: identifierType,
                password_generated: passwordGenerated,
            },
            password,
            phone,
            phone_confirm: true,
            user_metadata: {
                full_name: fullName,
            },
        })
        : await adminSupabase.auth.admin.createUser({
            app_metadata: {
                created_role: requestedRole,
                creation_method: "admin_password_account",
                identifier_type: identifierType,
                password_generated: passwordGenerated,
            },
            email,
            email_confirm: true,
            password,
            user_metadata: {
                full_name: fullName,
            },
        })

    if (createError || !created.user) {
        return json({
            error: createError?.message ?? "The account service did not return the created user.",
        }, 400)
    }

    const userId = created.user.id
    const { error: profileError } = await adminSupabase
        .from("profiles")
        .upsert(
            {
                full_name: fullName,
                id: userId,
                phone: identifierType === "phone" ? phone : undefined,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "id",
            }
        )

    if (profileError) {
        await cleanupCreatedAuthUser(adminSupabase, userId)
        return json({ error: profileError.message }, 400)
    }

    const { error: roleError } = await adminSupabase
        .from("user_roles")
        .upsert(
            {
                role: requestedRole,
                user_id: userId,
            },
            {
                onConflict: "user_id,role",
            }
        )

    if (roleError) {
        await cleanupCreatedAuthUser(adminSupabase, userId)
        return json({ error: roleError.message }, 400)
    }

    const subAdminPermissionKeys = [
        input.grantAccountsPageAccess === true ? "accounts" : null,
        input.grantAccountInfoPageAccess === true ? "account_info" : null,
    ].filter((permissionKey): permissionKey is "accounts" | "account_info" => Boolean(permissionKey))

    if (requestedRole === "sub_admin" && subAdminPermissionKeys.length > 0) {
        const { error: permissionError } = await adminSupabase
            .from("admin_dashboard_permissions")
            .upsert(
                subAdminPermissionKeys.map((permissionKey) => ({
                    granted_by: access.user.id,
                    permission_key: permissionKey,
                    user_id: userId,
                })),
                {
                    onConflict: "user_id,permission_key",
                }
            )

        if (permissionError) {
            await cleanupCreatedAuthUser(adminSupabase, userId)
            return json({ error: permissionError.message }, 400)
        }
    }

    const { error: auditError } = await adminSupabase.from("audit_logs").insert({
        action: "create_manual_account",
        actor_id: access.user.id,
        actor_role: access.primaryRole,
        entity_id: userId,
        entity_type: "auth_user",
        metadata: {
            email: identifierType === "email" ? email : null,
            full_name: fullName,
            granted_permission_keys: requestedRole === "sub_admin" ? subAdminPermissionKeys : [],
            identifier_type: identifierType,
            password_generated: passwordGenerated,
            phone: identifierType === "phone" ? phone : null,
            role: requestedRole,
        },
    })

    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/accounts/created")
    revalidatePath("/dashboard/account-info")
    revalidatePath("/dashboard/admins")
    revalidatePath("/dashboard")

    return json({
        createdUser: {
            email: identifierType === "email" ? email : undefined,
            id: userId,
            identifierType,
            passwordGenerated,
            phone: identifierType === "phone" ? phone : undefined,
            role: requestedRole,
        },
        success: true,
        warning: auditError
            ? "The account is ready to sign in, but its audit entry could not be saved."
            : undefined,
    })
}
