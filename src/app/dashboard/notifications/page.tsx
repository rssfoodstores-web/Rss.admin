import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    buildNotificationRecipientLabel,
    groupNotificationHistory,
    type NotificationHistoryRow,
    type NotificationRecipientLabel,
} from "@/lib/admin-notifications"
import { NotificationsPageClient } from "./NotificationsPageClient"

export default async function NotificationsPage() {
    const access = await requireAdminRouteAccess("notifications")
    const supabase = access.supabase

    const [totalRecipientsResult, historyResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
            .from("notifications")
            .select("id, user_id, title, message, type, read, created_at, action_url, metadata")
            .order("created_at", { ascending: false })
            .limit(200),
    ])

    if (historyResult.error) {
        throw new Error(historyResult.error.message)
    }

    const rows = (historyResult.data ?? []) as NotificationHistoryRow[]
    const recipientIds = Array.from(new Set(rows.map((row) => row.user_id)))
    const recipientMap = new Map<string, string>()

    if (recipientIds.length > 0) {
        const recipientResult = await supabase
            .from("profiles")
            .select("id, full_name, company_name, phone")
            .in("id", recipientIds)

        if (recipientResult.error) {
            throw new Error(recipientResult.error.message)
        }

        for (const recipient of (recipientResult.data ?? []) as NotificationRecipientLabel[]) {
            recipientMap.set(recipient.id, buildNotificationRecipientLabel(recipient))
        }
    }

    return (
        <NotificationsPageClient
            initialHistory={groupNotificationHistory(rows, recipientMap)}
            totalRecipients={totalRecipientsResult.count ?? 0}
        />
    )
}
