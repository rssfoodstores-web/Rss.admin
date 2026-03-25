import { SidebarProvider } from "@/components/dashboard/sidebar-provider"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { getAdminAccessContext } from "@/lib/admin-auth"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const access = await getAdminAccessContext()

    return (
        <SidebarProvider>
            <DashboardShell
                allowedRouteKeys={access.allowedRouteKeys}
            >
                {children}
            </DashboardShell>
        </SidebarProvider>
    )
}
