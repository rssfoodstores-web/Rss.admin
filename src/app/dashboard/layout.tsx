import { SidebarProvider } from "@/components/dashboard/sidebar-provider"
import { AdminSessionRefresher } from "@/components/dashboard/AdminSessionRefresher"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { getAdminAccessContext } from "@/lib/admin-auth"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const access = await getAdminAccessContext()
    const jwtRoles = Array.isArray(access.user.app_metadata?.roles)
        ? access.user.app_metadata.roles.filter((role): role is string => typeof role === "string")
        : []

    return (
        <SidebarProvider>
            <AdminSessionRefresher expectedRoles={access.roleNames} jwtRoles={jwtRoles} />
            <DashboardShell
                allowedRouteKeys={access.allowedRouteKeys}
            >
                {children}
            </DashboardShell>
        </SidebarProvider>
    )
}
