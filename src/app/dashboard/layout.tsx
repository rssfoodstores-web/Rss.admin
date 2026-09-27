import { SidebarProvider } from "@/components/dashboard/sidebar-provider"
import { AdminSessionRefresher } from "@/components/dashboard/AdminSessionRefresher"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { getAdminAccessContext } from "@/lib/admin-auth"
import { getAdminActivitySnapshot } from "@/lib/admin-activity"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const access = await getAdminAccessContext()
    const activity = await getAdminActivitySnapshot(access.supabase, access.allowedRouteKeys)
    const jwtRoles = Array.isArray(access.user.app_metadata?.roles)
        ? access.user.app_metadata.roles.filter((role): role is string => typeof role === "string")
        : []

    return (
        <SidebarProvider>
            <AdminSessionRefresher expectedRoles={access.roleNames} jwtRoles={jwtRoles} />
            <DashboardShell
                allowedRouteKeys={access.allowedRouteKeys}
                initialActivity={activity}
            >
                {children}
            </DashboardShell>
        </SidebarProvider>
    )
}
