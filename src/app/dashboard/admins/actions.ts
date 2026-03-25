"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { type AdminRouteKey, getAssignableAdminRoutes, normalizeAssignablePermissionKeys } from "@/lib/admin-routes"

interface AdminManagementResult {
    error?: string
    success?: true
}

export interface AdminManagementUserOption {
    avatarUrl: string | null
    companyName: string | null
    fullName: string
    id: string
    phone: string | null
    roleSummary: string
    updatedAt: string | null
}

export interface ManagedAdminRecord {
    avatarUrl: string | null
    companyName: string | null
    createdAt: string | null
    fullName: string
    id: string
    permissionKeys: AdminRouteKey[]
    phone: string | null
    role: "admin" | "sub_admin" | "supa_admin"
    updatedAt: string | null
}

export interface AdminManagementPageData {
    admins: ManagedAdminRecord[]
    assignablePermissions: Array<{
        href: string
        key: AdminRouteKey
        title: string
    }>
    currentRole: "admin" | "supa_admin"
    users: AdminManagementUserOption[]
}

interface SaveAdminAccessInput {
    permissionKeys: string[]
    role: "admin" | "sub_admin" | "none"
    userId: string
}

function sortRoles(roleNames: string[]) {
    const roleOrder = ["supa_admin", "admin", "sub_admin", "merchant", "agent", "rider", "customer"]

    return Array.from(new Set(roleNames)).sort((left, right) => {
        const leftIndex = roleOrder.indexOf(left)
        const rightIndex = roleOrder.indexOf(right)
        return (leftIndex === -1 ? roleOrder.length : leftIndex) - (rightIndex === -1 ? roleOrder.length : rightIndex)
    })
}

async function writeAuditLog(
    access: Awaited<ReturnType<typeof requireAdminRoleAccess>>,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>
) {
    await access.supabase.from("audit_logs").insert({
        actor_id: access.user.id,
        actor_role: access.primaryRole,
        action,
        entity_type: "user_role",
        entity_id: entityId,
        metadata,
    })
}

export async function getAdminManagementPageData(): Promise<AdminManagementPageData> {
    const access = await requireAdminRoleAccess(["admin", "supa_admin"], "admins")
    const assignablePermissions = getAssignableAdminRoutes().map((permission) => ({
        href: permission.href,
        key: permission.key,
        title: permission.title,
    }))

    const [{ data: adminRoleRows }, { data: profileRows }, { data: permissionRows }, { data: userRoleRows }] = await Promise.all([
        access.supabase
            .from("user_roles")
            .select("user_id, role, created_at")
            .in("role", ["admin", "sub_admin", "supa_admin"]),
        access.supabase
            .from("profiles")
            .select("id, full_name, company_name, phone, avatar_url, updated_at")
            .order("updated_at", { ascending: false })
            .limit(300),
        access.supabase
            .from("admin_dashboard_permissions")
            .select("user_id, permission_key"),
        access.supabase
            .from("user_roles")
            .select("user_id, role"),
    ])

    const profileMap = new Map(
        (profileRows ?? []).map((profile) => [
            profile.id,
            {
                avatarUrl: profile.avatar_url ?? null,
                companyName: profile.company_name ?? null,
                fullName: profile.full_name,
                id: profile.id,
                phone: profile.phone ?? null,
                updatedAt: profile.updated_at ?? null,
            },
        ])
    )

    const permissionMap = new Map<string, AdminRouteKey[]>()
    for (const row of permissionRows ?? []) {
        const nextKeys = permissionMap.get(row.user_id) ?? []
        nextKeys.push(row.permission_key as AdminRouteKey)
        permissionMap.set(row.user_id, normalizeAssignablePermissionKeys(nextKeys))
    }

    const rolesByUser = new Map<string, string[]>()
    for (const row of userRoleRows ?? []) {
        const nextRoles = rolesByUser.get(row.user_id) ?? []
        nextRoles.push(row.role)
        rolesByUser.set(row.user_id, sortRoles(nextRoles))
    }

    const admins = (adminRoleRows ?? [])
        .map((row) => {
            const profile = profileMap.get(row.user_id)
            if (!profile) {
                return null
            }

            return {
                ...profile,
                createdAt: row.created_at ?? null,
                permissionKeys: permissionMap.get(row.user_id) ?? [],
                role: row.role as ManagedAdminRecord["role"],
            }
        })
        .filter((record): record is ManagedAdminRecord => Boolean(record))
        .sort((left, right) => {
            const roleOrder = { supa_admin: 0, admin: 1, sub_admin: 2 }
            const roleDelta = roleOrder[left.role] - roleOrder[right.role]
            if (roleDelta !== 0) {
                return roleDelta
            }

            return left.fullName.localeCompare(right.fullName)
        })

    const users = (profileRows ?? []).map((profile) => ({
        avatarUrl: profile.avatar_url ?? null,
        companyName: profile.company_name ?? null,
        fullName: profile.full_name,
        id: profile.id,
        phone: profile.phone ?? null,
        roleSummary: (rolesByUser.get(profile.id) ?? ["customer"]).join(", "),
        updatedAt: profile.updated_at ?? null,
    }))

    return {
        admins,
        assignablePermissions,
        currentRole: access.primaryRole as "admin" | "supa_admin",
        users,
    }
}

export async function saveAdminAccess(input: SaveAdminAccessInput): Promise<AdminManagementResult> {
    const access = await requireAdminRoleAccess(["admin", "supa_admin"], "admins")
    const userId = input.userId.trim()

    if (!userId) {
        return { error: "Select a user first." }
    }

    if (userId === access.user.id) {
        return { error: "You cannot change your own admin access from this page." }
    }

    const normalizedPermissionKeys = normalizeAssignablePermissionKeys(input.permissionKeys)
    const { data: existingRoles } = await access.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "sub_admin", "supa_admin"])

    if ((existingRoles ?? []).some((roleRow) => roleRow.role === "supa_admin")) {
        return { error: "Super admin access is protected and cannot be changed here." }
    }

    const { error: deleteRoleError } = await access.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .in("role", ["admin", "sub_admin"])

    if (deleteRoleError) {
        return { error: deleteRoleError.message }
    }

    if (input.role !== "none") {
        const { error: upsertRoleError } = await access.supabase
            .from("user_roles")
            .upsert(
                {
                    role: input.role,
                    user_id: userId,
                },
                {
                    onConflict: "user_id,role",
                }
            )

        if (upsertRoleError) {
            return { error: upsertRoleError.message }
        }
    }

    const { error: clearPermissionError } = await access.supabase
        .from("admin_dashboard_permissions")
        .delete()
        .eq("user_id", userId)

    if (clearPermissionError) {
        return { error: clearPermissionError.message }
    }

    if (input.role === "sub_admin" && normalizedPermissionKeys.length > 0) {
        const { error: insertPermissionError } = await access.supabase
            .from("admin_dashboard_permissions")
            .insert(
                normalizedPermissionKeys.map((permissionKey) => ({
                    granted_by: access.user.id,
                    permission_key: permissionKey,
                    user_id: userId,
                }))
            )

        if (insertPermissionError) {
            return { error: insertPermissionError.message }
        }
    }

    await writeAuditLog(
        access,
        input.role === "none" ? "revoke_admin_access" : "update_admin_access",
        userId,
        {
            assigned_role: input.role,
            permission_keys: input.role === "sub_admin" ? normalizedPermissionKeys : [],
        }
    )

    revalidatePath("/dashboard/admins")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard")
    return { success: true }
}
