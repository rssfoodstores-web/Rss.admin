export const NOTIFICATION_ROLE_OPTIONS = [
    { value: "customer", label: "Customers" },
    { value: "merchant", label: "Merchants" },
    { value: "agent", label: "Agents" },
    { value: "rider", label: "Riders" },
    { value: "admin", label: "Admins" },
    { value: "sub_admin", label: "Sub-admins" },
    { value: "supa_admin", label: "Super admins" },
] as const

export type NotificationRecipientRole = (typeof NOTIFICATION_ROLE_OPTIONS)[number]["value"]

export interface NotificationRecipientLabel {
    company_name?: string | null
    full_name?: string | null
    id: string
    phone?: string | null
}

export interface NotificationRecipientDirectoryItem extends NotificationRecipientLabel {
    roles: NotificationRecipientRole[]
}

export interface NotificationRoleSummary {
    count: number
    label: string
    role: NotificationRecipientRole
}

export interface NotificationHistoryRow {
    action_url: string | null
    created_at: string
    id: string
    message: string
    metadata: unknown
    read: boolean
    title: string
    type: string | null
    user_id: string
}

export interface NotificationHistoryItem {
    actionUrl: string | null
    audience: "all" | "single" | "role"
    batchId: string
    createdAt: string
    deliveredCount: number
    id: string
    message: string
    recipientCount: number
    recipientLabels: string[]
    targetRole: NotificationRecipientRole | null
    title: string
    type: string | null
    unreadCount: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

export function buildNotificationRecipientLabel(recipient: NotificationRecipientLabel) {
    return recipient.full_name?.trim()
        || recipient.company_name?.trim()
        || recipient.phone?.trim()
        || recipient.id.slice(0, 8)
}

export function getNotificationRoleLabel(role: NotificationRecipientRole) {
    return NOTIFICATION_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role.replace(/_/g, " ")
}

export function normalizeNotificationRecipientRoles(roles: string[]): NotificationRecipientRole[] {
    const normalizedRoles = Array.from(
        new Set(
            roles.filter((role): role is NotificationRecipientRole =>
                NOTIFICATION_ROLE_OPTIONS.some((option) => option.value === role)
            )
        )
    )

    return normalizedRoles.length > 0 ? normalizedRoles : ["customer"]
}

export function recipientHasRole(
    recipient: NotificationRecipientDirectoryItem,
    role: NotificationRecipientRole
) {
    return recipient.roles.includes(role)
}

export function groupNotificationHistory(
    rows: NotificationHistoryRow[],
    recipientMap: Map<string, string>
): NotificationHistoryItem[] {
    const grouped = new Map<string, NotificationHistoryItem>()

    for (const row of rows) {
        const metadata = asRecord(row.metadata)
        const batchId = typeof metadata?.batch_id === "string" && metadata.batch_id.trim()
            ? metadata.batch_id.trim()
            : row.id
        const audience = metadata?.audience === "all"
            ? "all"
            : metadata?.audience === "role"
                ? "role"
                : "single"
        const targetRole = typeof metadata?.target_role === "string"
            && NOTIFICATION_ROLE_OPTIONS.some((option) => option.value === metadata.target_role)
            ? metadata.target_role as NotificationRecipientRole
            : null
        const existing = grouped.get(batchId)
        const recipientLabel = recipientMap.get(row.user_id) ?? row.user_id.slice(0, 8)

        if (existing) {
            existing.recipientCount += 1
            existing.deliveredCount += 1
            if (!row.read) {
                existing.unreadCount += 1
            }
            if (!existing.recipientLabels.includes(recipientLabel) && existing.recipientLabels.length < 4) {
                existing.recipientLabels.push(recipientLabel)
            }
            continue
        }

        grouped.set(batchId, {
            actionUrl: row.action_url,
            audience,
            batchId,
            createdAt: row.created_at,
            deliveredCount: 1,
            id: row.id,
            message: row.message,
            recipientCount: 1,
            recipientLabels: [recipientLabel],
            targetRole,
            title: row.title,
            type: row.type,
            unreadCount: row.read ? 0 : 1,
        })
    }

    return Array.from(grouped.values()).sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
}
