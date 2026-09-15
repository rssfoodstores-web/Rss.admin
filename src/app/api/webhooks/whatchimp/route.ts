import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-center"

function findString(value: unknown, keys: string[]): string | null {
    if (!value || typeof value !== "object") return null
    const record = value as Record<string, unknown>
    for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string
    for (const nested of Object.values(record)) {
        const found = findString(nested, keys)
        if (found) return found
    }
    return null
}

export async function POST(request: NextRequest) {
    const admin = createAdminClient()
    const { data: connection } = await admin.from("whatsapp_connections").select("webhook_secret").eq("id", "primary").maybeSingle()
    if (!connection?.webhook_secret || request.nextUrl.searchParams.get("key") !== connection.webhook_secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: unknown = await request.json().catch(() => null)
    const phone = normalizeWhatsAppPhone(findString(payload, ["phone", "phone_number", "from", "sender", "wa_id"]) ?? "")
    const body = findString(payload, ["message", "message_content", "body", "text", "caption"])
    if (!phone || !body) return NextResponse.json({ received: true, stored: false })

    const externalId = findString(payload, ["wa_message_id", "message_id", "wamid", "id"])
    let { data: contact } = await admin.from("whatsapp_contacts").select("id, full_name").eq("phone", phone).maybeSingle()
    if (!contact) {
        const name = findString(payload, ["name", "customer_name", "profile_name"]) ?? phone
        const inserted = await admin.from("whatsapp_contacts").insert({ full_name: name, is_active: true, opted_in: true, phone, source: "import" }).select("id, full_name").single()
        contact = inserted.data
    }
    if (!contact) return NextResponse.json({ error: "Could not identify customer" }, { status: 400 })

    const { error } = await admin.from("whatsapp_messages").upsert({
        body,
        contact_id: contact.id,
        direction: "inbound",
        external_message_id: externalId,
        message_type: "session",
        metadata: payload,
        status: "received",
    }, externalId ? { onConflict: "external_message_id", ignoreDuplicates: true } : undefined)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from("whatsapp_contacts").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contact.id)
    const [{ data: roles }, { data: grants }] = await Promise.all([
        admin.from("user_roles").select("user_id").in("role", ["admin", "sub_admin", "supa_admin"]),
        admin.from("whatsapp_access_grants").select("user_id"),
    ])
    const recipients = new Set([...(roles ?? []).map((row) => row.user_id), ...(grants ?? []).map((row) => row.user_id)])
    if (recipients.size) await admin.from("notifications").insert([...recipients].map((userId) => ({
        action_url: "/dashboard/whatsapp",
        message: body.slice(0, 180),
        metadata: { contact_id: contact.id, source: "whatsapp" },
        read: false,
        title: `New WhatsApp reply from ${contact.full_name}`,
        type: "whatsapp_reply",
        user_id: userId,
    })))

    return NextResponse.json({ received: true, stored: true })
}
