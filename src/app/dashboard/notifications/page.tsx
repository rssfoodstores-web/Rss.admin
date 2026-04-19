import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    buildNotificationRecipientLabel,
    groupNotificationHistory,
    normalizeNotificationRecipientRoles,
    type NotificationHistoryRow,
    type NotificationRecipientDirectoryItem,
    type NotificationRecipientLabel,
    type NotificationRoleSummary,
    NOTIFICATION_ROLE_OPTIONS,
} from "@/lib/admin-notifications"
import { NotificationsPageClient } from "./NotificationsPageClient"

export default async function NotificationsPage() {
    const access = await requireAdminRouteAccess("notifications")
    const supabase = access.supabase

    const [totalRecipientsResult, historyResult, profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
            .from("notifications")
            .select("id, user_id, title, message, type, read, created_at, action_url, metadata")
            .order("created_at", { ascending: false })
            .limit(200),
        supabase
            .from("profiles")
            .select("id, full_name, company_name, phone, updated_at")
            .order("updated_at", { ascending: false }),
        supabase
            .from("user_roles")
            .select("user_id, role"),
    ])

    if (historyResult.error || profilesResult.error || rolesResult.error) {
        throw new Error(historyResult.error?.message ?? profilesResult.error?.message ?? rolesResult.error?.message ?? "Could not load notifications page data.")
    }

    const rows = (historyResult.data ?? []) as NotificationHistoryRow[]
    const rolesByUser = new Map<string, string[]>()
    for (const row of rolesResult.data ?? []) {
        const nextRoles = rolesByUser.get(row.user_id) ?? []
        nextRoles.push(String(row.role ?? ""))
        rolesByUser.set(row.user_id, nextRoles)
    }

    const recipientDirectory = ((profilesResult.data ?? []) as NotificationRecipientLabel[]).map((profile) => ({
        ...profile,
        roles: normalizeNotificationRecipientRoles(rolesByUser.get(profile.id) ?? []),
    })) satisfies NotificationRecipientDirectoryItem[]

    const roleSummaries = NOTIFICATION_ROLE_OPTIONS.map((option) => ({
        count: recipientDirectory.filter((recipient) => recipient.roles.includes(option.value)).length,
        label: option.label,
        role: option.value,
    })) satisfies NotificationRoleSummary[]

    const recipientIds = Array.from(new Set(rows.map((row) => row.user_id)))
    const recipientMap = new Map<string, string>()
    for (const recipient of recipientDirectory.filter((item) => recipientIds.includes(item.id))) {
        recipientMap.set(recipient.id, buildNotificationRecipientLabel(recipient))
    }

    return (
        <NotificationsPageClient
            initialHistory={groupNotificationHistory(rows, recipientMap)}
            recipientDirectory={recipientDirectory}
            roleSummaries={roleSummaries}
            totalRecipients={totalRecipientsResult.count ?? 0}
        />
    )
}
