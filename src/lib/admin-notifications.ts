export interface NotificationRecipientLabel {
    company_name?: string | null
    full_name?: string | null
    id: string
    phone?: string | null
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
    audience: "all" | "single"
    batchId: string
    createdAt: string
    deliveredCount: number
    id: string
    message: string
    recipientCount: number
    recipientLabels: string[]
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
        const audience = metadata?.audience === "all" ? "all" : "single"
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
            title: row.title,
            type: row.type,
            unreadCount: row.read ? 0 : 1,
        })
    }

    return Array.from(grouped.values()).sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
}
