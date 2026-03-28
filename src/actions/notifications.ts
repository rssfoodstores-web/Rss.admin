"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { buildNotificationRecipientLabel, type NotificationHistoryItem, type NotificationRecipientLabel } from "@/lib/admin-notifications"

export type SendMessageState = {
    audience?: "all" | "single"
    historyEntry?: NotificationHistoryItem | null
    message?: string | null
    sentCount?: number
    errors?: {
        action_url?: string[]
        message?: string[]
        title?: string[]
        userId?: string[]
    }
}

function trimField(value: FormDataEntryValue | null) {
    return typeof value === "string" ? value.trim() : ""
}

function normalizeActionUrl(value: string) {
    if (!value) {
        return null
    }

    if (value.startsWith("/")) {
        return value
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value
    }

    throw new Error("Action link must start with /, http://, or https://")
}

function chunk<T>(items: T[], size: number) {
    const result: T[][] = []

    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size))
    }

    return result
}

export async function sendUserMessage(prevState: SendMessageState, formData: FormData): Promise<SendMessageState> {
    const access = await requireAdminRouteAccess("notifications")
    const supabase = access.supabase

    const audience = trimField(formData.get("audience")) === "all" ? "all" : "single"
    const userId = trimField(formData.get("userId"))
    const title = trimField(formData.get("title"))
    const message = trimField(formData.get("message"))
    const type = trimField(formData.get("type")) || "admin_message"

    if (!title || !message) {
        return {
            audience,
            message: "Missing required fields",
            errors: {
                message: !message ? ["Message is required"] : [],
                title: !title ? ["Title is required"] : [],
                userId: audience === "single" && !userId ? ["Select a recipient"] : [],
            },
        }
    }

    if (audience === "single" && !userId) {
        return {
            audience,
            message: "Select a recipient before sending.",
            errors: {
                userId: ["Select a recipient"],
            },
        }
    }

    let actionUrl: string | null = null

    try {
        actionUrl = normalizeActionUrl(trimField(formData.get("action_url")))
    } catch (error) {
        return {
            audience,
            message: error instanceof Error ? error.message : "Invalid action link.",
            errors: {
                action_url: [error instanceof Error ? error.message : "Invalid action link."],
            },
        }
    }

    try {
        const recipientResponse = audience === "all"
            ? await supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .order("updated_at", { ascending: false })
            : await supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .eq("id", userId)

        if (recipientResponse.error) {
            console.error("Notification recipient lookup failed:", recipientResponse.error)
            return { audience, message: "Could not load notification recipients." }
        }

        const recipients = (recipientResponse.data ?? []) as NotificationRecipientLabel[]

        if (recipients.length === 0) {
            return {
                audience,
                message: audience === "all" ? "There are no users to notify yet." : "The selected recipient was not found.",
            }
        }

        const batchId = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        const rows = recipients.map((recipient) => ({
            action_url: actionUrl,
            created_at: createdAt,
            message,
            metadata: {
                audience,
                batch_id: batchId,
                sender_id: access.user.id,
            },
            read: false,
            title,
            type,
            user_id: recipient.id,
        }))

        for (const batch of chunk(rows, 500)) {
            const { error } = await supabase
                .from("notifications")
                .insert(batch)

            if (error) {
                console.error("Notification insert failed:", error)
                return { audience, message: "Failed to send notifications." }
            }
        }

        revalidatePath("/dashboard/notifications")
        revalidatePath("/dashboard/accounts")
        revalidatePath("/account/notifications")

        return {
            audience,
            historyEntry: {
                actionUrl,
                audience,
                batchId,
                createdAt,
                deliveredCount: recipients.length,
                id: batchId,
                message,
                recipientCount: recipients.length,
                recipientLabels: recipients.slice(0, 4).map(buildNotificationRecipientLabel),
                title,
                type,
                unreadCount: recipients.length,
            },
            message: "success",
            sentCount: recipients.length,
        }
    } catch (error) {
        console.error("Unexpected error sending notifications:", error)
        return { audience, message: "An unexpected error occurred." }
    }
}
