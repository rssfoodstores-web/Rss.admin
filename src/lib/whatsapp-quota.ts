import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export const RSS_WHATSAPP_RECIPIENT_LIMIT = 250

export class WhatsAppQuotaExceededError extends Error {
    constructor() {
        super("RSS's 250-recipient safety cap is full. Wait for the countdown before starting another send.")
        this.name = "WhatsAppQuotaExceededError"
    }
}

export interface WhatsAppQuotaStatus {
    limit: number
    used: number
    remaining: number
    nextAvailableAt: string | null
}

export async function getWhatsAppQuotaStatus(): Promise<WhatsAppQuotaStatus> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("whatsapp_outbound_quota_status")
    if (error || !Array.isArray(data) || !data[0]) {
        throw new Error("RSS cannot verify the WhatsApp send allowance. Sending is blocked until this check works.")
    }
    const used = Number(data[0].used_count)
    if (!Number.isSafeInteger(used) || used < 0) throw new Error("Invalid WhatsApp send allowance. Sending is blocked.")
    return {
        limit: RSS_WHATSAPP_RECIPIENT_LIMIT,
        used,
        remaining: Math.max(0, RSS_WHATSAPP_RECIPIENT_LIMIT - used),
        nextAvailableAt: typeof data[0].next_available_at === "string" ? data[0].next_available_at : null,
    }
}

export async function reserveWhatsAppRecipient(phone: string): Promise<void> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("whatsapp_reserve_outbound_recipient", {
        p_phone: phone,
        p_limit: RSS_WHATSAPP_RECIPIENT_LIMIT,
    })
    if (error || !Array.isArray(data) || !data[0]) {
        throw new Error("RSS could not reserve a WhatsApp send slot. No message was sent.")
    }
    if (data[0].allowed !== true) {
        throw new WhatsAppQuotaExceededError()
    }
}
