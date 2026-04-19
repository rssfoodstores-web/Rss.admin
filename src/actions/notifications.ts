"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    buildNotificationRecipientLabel,
    normalizeNotificationRecipientRoles,
    recipientHasRole,
    type NotificationHistoryItem,
    type NotificationRecipientDirectoryItem,
    type NotificationRecipientLabel,
    type NotificationRecipientRole,
} from "@/lib/admin-notifications"

export type SendMessageState = {
    audience?: "all" | "single" | "role"
    historyEntry?: NotificationHistoryItem | null
    message?: string | null
    sentCount?: number
    targetRole?: NotificationRecipientRole | null
    errors?: {
        action_url?: string[]
        message?: string[]
        targetRole?: string[]
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

function parseNotificationRecipientRole(value: string): NotificationRecipientRole | null {
    if (!value) {
        return null
    }

    const [normalizedRole] = normalizeNotificationRecipientRoles([value])
    return normalizedRole ?? null
}

export async function sendUserMessage(prevState: SendMessageState, formData: FormData): Promise<SendMessageState> {
    const access = await requireAdminRouteAccess("notifications")
    const supabase = access.supabase

    const audienceValue = trimField(formData.get("audience"))
    const audience = audienceValue === "all" ? "all" : audienceValue === "role" ? "role" : "single"
    const userId = trimField(formData.get("userId"))
    const targetRoleValue = trimField(formData.get("targetRole"))
    const targetRole = parseNotificationRecipientRole(targetRoleValue)
    const title = trimField(formData.get("title"))
    const message = trimField(formData.get("message"))
    const type = trimField(formData.get("type")) || "admin_message"

    if (!title || !message) {
        return {
            audience,
            message: "Missing required fields",
            errors: {
                message: !message ? ["Message is required"] : [],
                targetRole: audience === "role" && !targetRole ? ["Select a recipient role"] : [],
                title: !title ? ["Title is required"] : [],
                userId: audience === "single" && !userId ? ["Select a recipient"] : [],
            },
            targetRole,
        }
    }

    if (audience === "single" && !userId) {
        return {
            audience,
            message: "Select a recipient before sending.",
            errors: {
                userId: ["Select a recipient"],
            },
            targetRole,
        }
    }

    if (audience === "role" && !targetRole) {
        return {
            audience,
            message: "Select a role before sending.",
            errors: {
                targetRole: ["Select a recipient role"],
            },
            targetRole,
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
            targetRole,
        }
    }

    try {
        let recipients: NotificationRecipientLabel[] = []

        if (audience === "all") {
            const recipientResponse = await supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .order("updated_at", { ascending: false })

            if (recipientResponse.error) {
                console.error("Notification recipient lookup failed:", recipientResponse.error)
                return { audience, message: "Could not load notification recipients.", targetRole }
            }

            recipients = (recipientResponse.data ?? []) as NotificationRecipientLabel[]
        } else if (audience === "single") {
            const recipientResponse = await supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .eq("id", userId)

            if (recipientResponse.error) {
                console.error("Notification recipient lookup failed:", recipientResponse.error)
                return { audience, message: "Could not load notification recipients.", targetRole }
            }

            recipients = (recipientResponse.data ?? []) as NotificationRecipientLabel[]
        } else {
            const selectedRole = targetRole as NotificationRecipientRole
            const [profileResponse, roleResponse] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, full_name, company_name, phone")
                    .order("updated_at", { ascending: false }),
                supabase
                    .from("user_roles")
                    .select("user_id, role"),
            ])

            if (profileResponse.error || roleResponse.error) {
                console.error("Notification recipient lookup failed:", profileResponse.error ?? roleResponse.error)
                return { audience, message: "Could not load notification recipients.", targetRole }
            }

            const rolesByUser = new Map<string, string[]>()
            for (const row of roleResponse.data ?? []) {
                const nextRoles = rolesByUser.get(row.user_id) ?? []
                nextRoles.push(String(row.role ?? ""))
                rolesByUser.set(row.user_id, nextRoles)
            }

            const recipientsByRole = ((profileResponse.data ?? []) as NotificationRecipientLabel[])
                .map((profile) => ({
                    ...profile,
                    roles: normalizeNotificationRecipientRoles(rolesByUser.get(profile.id) ?? []),
                })) satisfies NotificationRecipientDirectoryItem[]

            recipients = recipientsByRole.filter((recipient) => recipientHasRole(recipient, selectedRole))
        }

        if (recipients.length === 0) {
            return {
                audience,
                message: audience === "all"
                    ? "There are no users to notify yet."
                    : audience === "role"
                        ? "No users currently match that role."
                        : "The selected recipient was not found.",
                targetRole,
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
                target_role: audience === "role" ? targetRole : null,
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
                return { audience, message: "Failed to send notifications.", targetRole }
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
            targetRole: audience === "role" ? targetRole : null,
            title,
            type,
            unreadCount: recipients.length,
        },
        message: "success",
        sentCount: recipients.length,
        targetRole,
        }
    } catch (error) {
        console.error("Unexpected error sending notifications:", error)
        return { audience, message: "An unexpected error occurred.", targetRole }
    }
}
