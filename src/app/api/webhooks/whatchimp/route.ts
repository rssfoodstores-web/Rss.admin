import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-center"

type RecordValue = Record<string, unknown>
type IncomingMessage = { body: string; externalId: string | null; name: string | null; phone: string }

function record(value: unknown): RecordValue | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null
}

function string(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null
}

function parsePayload(raw: string, contentType: string): unknown {
    try { return JSON.parse(raw) as unknown } catch { /* Some providers post form data. */ }
    if (!contentType.includes("application/x-www-form-urlencoded")) return null
    return Object.fromEntries([...new URLSearchParams(raw)].map(([key, value]) => {
        try { return [key, JSON.parse(value) as unknown] } catch { return [key, value] }
    }))
}

function findString(value: unknown, keys: string[]): string | null {
    const item = record(value)
    if (!item) return null
    for (const key of keys) {
        const found = string(item[key])
        if (found) return found
    }
    for (const nested of Object.values(item)) {
        if (Array.isArray(nested)) {
            for (const child of nested) {
                const found = findString(child, keys)
                if (found) return found
            }
        } else {
            const found = findString(nested, keys)
            if (found) return found
        }
    }
    return null
}

function parseIncoming(payload: unknown): IncomingMessage[] {
    const root = record(payload)
    if (!root) return []

    // Meta-shaped webhooks can contain several messages and a WABA-level id.
    // Never mistake that WABA id for a unique customer message id.
    const entries = Array.isArray(root.entry) ? root.entry : []
    const metaMessages: IncomingMessage[] = []
    for (const entry of entries) {
        const changes = record(entry)?.changes
        for (const change of Array.isArray(changes) ? changes : []) {
            const value = record(record(change)?.value)
            const contacts = Array.isArray(value?.contacts) ? value.contacts : []
            for (const message of Array.isArray(value?.messages) ? value.messages : []) {
                const row = record(message)
                const phone = normalizeWhatsAppPhone(string(row?.from) ?? "")
                const body = string(record(row?.text)?.body)
                    ?? string(record(row?.button)?.text)
                    ?? string(record(record(row?.interactive)?.button_reply)?.title)
                    ?? string(record(record(row?.interactive)?.list_reply)?.title)
                    ?? string(record(row?.image)?.caption)
                    ?? string(record(row?.video)?.caption)
                if (!phone || !body) continue
                const matchingContact = contacts.find((item) => string(record(item)?.wa_id) === string(row?.from))
                metaMessages.push({
                    body,
                    externalId: string(row?.id),
                    name: string(record(record(matchingContact)?.profile)?.name),
                    phone,
                })
            }
        }
    }
    if (metaMessages.length) return metaMessages

    const phone = normalizeWhatsAppPhone(findString(root, ["wa_id", "from", "sender", "phone", "phone_number"]) ?? "")
    const body = findString(root, ["message_content", "body", "text", "caption", "message"])
    if (!phone || !body) return []
    return [{
        body,
        externalId: findString(root, ["wa_message_id", "message_id", "wamid"]),
        name: findString(root, ["profile_name", "customer_name", "name"]),
        phone,
    }]
}

export async function POST(request: NextRequest) {
    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
        .select("webhook_secret").eq("id", "primary").maybeSingle()
    if (connectionError || !connection?.webhook_secret || request.nextUrl.searchParams.get("key") !== connection.webhook_secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (Number(request.headers.get("content-length") ?? 0) > 256_000) {
        return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 })
    }
    const raw = await request.text().catch(() => "")
    if (raw.length > 256_000) return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 })
    const payload = parsePayload(raw, request.headers.get("content-type") ?? "")
    const incoming = parseIncoming(payload)
    const payloadKeys = Object.keys(record(payload) ?? {}).slice(0, 20).map((key) => key.slice(0, 64))
    const { data: receipt, error: receiptError } = await admin.from("whatsapp_inbound_receipts").insert({
        outcome: "received", message_count: incoming.length, payload_keys: payloadKeys,
    }).select("id").single()
    if (receiptError || !receipt) return NextResponse.json({ error: "Could not record webhook receipt" }, { status: 500 })
    const finish = async (outcome: "failed" | "ignored" | "stored", errorCode: string | null, count: number) => {
        await admin.from("whatsapp_inbound_receipts").update({ outcome, error_code: errorCode, message_count: count }).eq("id", receipt.id)
    }
    if (!incoming.length) {
        await finish("ignored", "no_supported_message", 0)
        return NextResponse.json({ received: true, stored: false })
    }

    let stored = 0
    for (const item of incoming) {
        let { data: contact, error: contactError } = await admin.from("whatsapp_contacts")
            .select("id, full_name").eq("phone", item.phone).maybeSingle()
        if (contactError) {
            await finish("failed", "contact_lookup", stored)
            return NextResponse.json({ error: "Could not find customer" }, { status: 500 })
        }
        if (!contact) {
            const inserted = await admin.from("whatsapp_contacts").upsert({
                full_name: item.name ?? item.phone,
                is_active: true,
                opted_in: false,
                phone: item.phone,
                source: "import",
            }, { onConflict: "phone", ignoreDuplicates: true })
            if (inserted.error) {
                await finish("failed", "contact_create", stored)
                return NextResponse.json({ error: "Could not create customer chat" }, { status: 500 })
            }
            const lookedUp = await admin.from("whatsapp_contacts").select("id, full_name").eq("phone", item.phone).single()
            contact = lookedUp.data
            contactError = lookedUp.error
        }
        if (contactError || !contact) {
            await finish("failed", "contact_identify", stored)
            return NextResponse.json({ error: "Could not identify customer" }, { status: 500 })
        }

        const { error: messageError } = await admin.from("whatsapp_messages").insert({
            body: item.body,
            contact_id: contact.id,
            direction: "inbound",
            external_message_id: item.externalId,
            message_type: "session",
            metadata: { source: "incoming_webhook" },
            status: "received",
        })
        if (messageError?.code === "23505") continue
        if (messageError) {
            await finish("failed", "message_insert", stored)
            return NextResponse.json({ error: "Could not save reply" }, { status: 500 })
        }
        stored += 1

        await Promise.all([
            admin.from("whatsapp_contacts").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contact.id),
            admin.from("whatsapp_messages").update({ contact_id: contact.id })
                .eq("direction", "outbound").is("contact_id", null).contains("metadata", { phone: item.phone }),
        ])

        const [{ data: owners }, { data: chatGrants }] = await Promise.all([
            admin.from("user_roles").select("user_id").eq("role", "supa_admin"),
            admin.from("whatsapp_access_grants").select("user_id").eq("can_use_chat", true),
        ])
        const recipients = new Set([...(owners ?? []).map((row) => row.user_id), ...(chatGrants ?? []).map((row) => row.user_id)])
        if (recipients.size) await admin.from("notifications").insert([...recipients].map((userId) => ({
            action_url: "/dashboard/whatsapp",
            message: item.body.slice(0, 180),
            metadata: { contact_id: contact.id, source: "whatsapp" },
            read: false,
            title: `New WhatsApp reply from ${contact.full_name}`,
            type: "whatsapp_reply",
            user_id: userId,
        })))
    }

    await finish("stored", null, stored)
    return NextResponse.json({ received: true, stored })
}
