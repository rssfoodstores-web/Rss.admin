import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { NotificationsPageClient } from "./NotificationsPageClient"

export default async function NotificationsPage() {
    await requireAdminRouteAccess("notifications")

    return <NotificationsPageClient />
}
