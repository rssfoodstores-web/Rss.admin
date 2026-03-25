import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
    type AdminAccessSnapshot,
    type AdminRole,
    type AdminRouteKey,
    getAccessibleAdminRoutes,
    getAdminRouteDefinition,
    getDefaultAdminRouteHref,
    getPrimaryAdminRole,
    normalizeAssignablePermissionKeys,
} from "@/lib/admin-routes"

export interface AdminAccessContext extends AdminAccessSnapshot {
    roleNames: string[]
    supabase: Awaited<ReturnType<typeof createClient>>
    user: User
}

function buildAccessDeniedHref(key: AdminRouteKey) {
    return `/dashboard/access-denied?from=${encodeURIComponent(key)}`
}

export async function getAdminAccessContext(): Promise<AdminAccessContext> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/")
    }

    const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin", "supa_admin"])

    const roleNames = Array.from(new Set((roleRows ?? []).map((row) => row.role)))
    const primaryRole = getPrimaryAdminRole(roleNames)

    if (!primaryRole) {
        redirect("/")
    }

    let assignedPermissionKeys: AdminRouteKey[] = []

    if (primaryRole === "sub_admin") {
        const { data: permissionRows } = await supabase
            .from("admin_dashboard_permissions")
            .select("permission_key")
            .eq("user_id", user.id)

        assignedPermissionKeys = normalizeAssignablePermissionKeys(
            (permissionRows ?? []).map((row) => String(row.permission_key ?? ""))
        )
    }

    const accessSnapshot: AdminAccessSnapshot = {
        primaryRole,
        assignedPermissionKeys,
        allowedRouteKeys:
            primaryRole === "sub_admin"
                ? getAccessibleAdminRoutes({
                    primaryRole,
                    assignedPermissionKeys,
                    allowedRouteKeys: [],
                }).map((route) => route.key)
                : getAccessibleAdminRoutes({
                    primaryRole,
                    assignedPermissionKeys: [],
                    allowedRouteKeys: [],
                }).map((route) => route.key),
    }

    return {
        ...accessSnapshot,
        roleNames,
        supabase,
        user,
    }
}

export async function requireAdminRouteAccess(key: AdminRouteKey, options?: { redirectToFirstAccessible?: boolean }) {
    const access = await getAdminAccessContext()

    if (access.allowedRouteKeys.includes(key)) {
        return access
    }

    if (options?.redirectToFirstAccessible) {
        redirect(getDefaultAdminRouteHref(access))
    }

    redirect(buildAccessDeniedHref(key))
}

export async function requireAdminRoleAccess(allowedRoles: AdminRole[], fallbackKey: AdminRouteKey) {
    const access = await getAdminAccessContext()

    if (allowedRoles.includes(access.primaryRole)) {
        return access
    }

    redirect(buildAccessDeniedHref(fallbackKey))
}

export function getAdminAccessDeniedContext(from: string | null | undefined) {
    const definition = from ? getAdminRouteDefinition(from as AdminRouteKey) : null

    return {
        requestedKey: definition?.key ?? null,
        requestedTitle: definition?.title ?? "this area",
    }
}
