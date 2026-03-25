"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

export type SendMessageState = {
    message?: string | null
    errors?: {
        title?: string[]
        message?: string[]
    }
}

export async function sendUserMessage(prevState: SendMessageState, formData: FormData): Promise<SendMessageState> {
    const access = await requireAdminRouteAccess("notifications")
    const supabase = access.supabase

    const userId = formData.get("userId") as string
    const title = formData.get("title") as string
    const message = formData.get("message") as string
    const type = "admin_message" // Default type

    // Simple validation
    if (!userId || !title || !message) {
        return {
            message: "Missing required fields",
            errors: {
                title: !title ? ["Title is required"] : [],
                message: !message ? ["Message is required"] : [],
            }
        }
    }

    try {
        const { error } = await supabase
            .from("notifications")
            .insert({
                user_id: userId,
                title,
                message,
                type,
                read: false,
                created_at: new Date().toISOString()
            })

        if (error) {
            console.error("Error sending message:", error)
            return { message: "Failed to send message via database." }
        }

        revalidatePath("/dashboard/accounts")
        return { message: "success" }

    } catch (error) {
        console.error("Unexpected error sending message:", error)
        return { message: "An unexpected error occurred." }
    }
}
