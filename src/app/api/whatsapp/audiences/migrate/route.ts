import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-center"

export const maxDuration = 300

export async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }
    try {
        const access = await requireAdminRouteAccess("whatsapp_center")
        const admin = createAdminClient()
        if (access.primaryRole !== "supa_admin") {
            const grant = await admin.from("whatsapp_access_grants").select("can_send_campaigns")
                .eq("user_id", access.user.id).maybeSingle()
            if (!grant.data?.can_send_campaigns) return NextResponse.json({ error: "No campaign access." }, { status: 403 })
        }
        const raw = await request.text()
        if (raw.length > 4_000_000) return NextResponse.json({ error: "This old audience is too large to migrate automatically." }, { status: 413 })
        const input: unknown = JSON.parse(raw)
        if (!input || typeof input !== "object") throw new Error("Invalid audience.")
        const audience = input as { name?: unknown; source?: unknown; columns?: unknown; rows?: unknown }
        const name = typeof audience.name === "string" ? audience.name.trim().slice(0, 120) : ""
        const columns = Array.isArray(audience.columns)
            ? Array.from(new Set(audience.columns.filter((value): value is string => typeof value === "string" && value.length < 100))).slice(0, 50)
            : []
        if (!name || !columns.length || !Array.isArray(audience.rows) || audience.rows.length > 50_000) {
            throw new Error("Old audience is missing a name, columns or valid rows.")
        }
        const created = await admin.from("whatsapp_audiences").insert({
            name, source: audience.source === "upload" ? "upload" : "database",
            filters: { migrated_from_browser: true }, columns, created_by: access.user.id,
        }).select("id").single()
        if (created.error || !created.data) throw new Error(created.error?.message ?? "Could not create audience.")
        try {
            const distinct = new Map<string, { audience_id: string; phone: string; consent: boolean; fields: Record<string, string> }>()
            for (const item of audience.rows) {
                if (!item || typeof item !== "object") continue
                const row = item as { consent?: unknown; phone?: unknown; fields?: unknown }
                const phone = normalizeWhatsAppPhone(typeof row.phone === "string" ? row.phone : "")
                if (!phone) continue
                const sourceFields = row.fields && typeof row.fields === "object" ? row.fields as Record<string, unknown> : {}
                const fields = Object.fromEntries(columns.map((column) => [column, typeof sourceFields[column] === "string" ? sourceFields[column].slice(0, 500) : ""]))
                distinct.set(phone, { audience_id: created.data.id, phone, consent: row.consent === true, fields })
            }
            const recipients = [...distinct.values()]
            if (!recipients.length) throw new Error("No valid numbers were found in the old audience.")
            for (let offset = 0; offset < recipients.length; offset += 500) {
                const result = await admin.from("whatsapp_audience_recipients").insert(recipients.slice(offset, offset + 500))
                if (result.error) throw new Error(result.error.message)
            }
            const count = recipients.filter((item) => item.consent).length
            const update = await admin.from("whatsapp_audiences").update({ row_count: recipients.length, consent_count: count }).eq("id", created.data.id)
            if (update.error) throw new Error(update.error.message)
            revalidatePath("/dashboard/whatsapp")
            return NextResponse.json({ id: created.data.id, count: recipients.length })
        } catch (error) {
            await admin.from("whatsapp_audiences").delete().eq("id", created.data.id)
            throw error
        }
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not migrate audience." }, { status: 400 })
    }
}
