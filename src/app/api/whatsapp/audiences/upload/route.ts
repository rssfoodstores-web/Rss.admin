import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-center"

export const maxDuration = 300

function parseCsv(text: string) {
    const matrix: string[][] = []
    let row: string[] = []
    let cell = ""
    let quoted = false
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i]
        if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
        else if (char === '"') quoted = !quoted
        else if (char === "," && !quoted) { row.push(cell.trim()); cell = "" }
        else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && text[i + 1] === "\n") i += 1
            row.push(cell.trim()); cell = ""
            if (row.some(Boolean)) matrix.push(row)
            row = []
        } else cell += char
    }
    if (quoted) throw new Error("The CSV contains an unfinished quoted field.")
    row.push(cell.trim())
    if (row.some(Boolean)) matrix.push(row)
    const headers = (matrix.shift() ?? []).map((header) => header.replace(/^\uFEFF/, ""))
    if (!headers.length || new Set(headers).size !== headers.length) throw new Error("CSV headings must be present and unique.")
    return { headers, rows: matrix }
}

export async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 })
    }
    try {
        const access = await requireAdminRouteAccess("whatsapp_center")
        const admin = createAdminClient()
        if (access.primaryRole !== "supa_admin") {
            const grant = await admin.from("whatsapp_access_grants").select("can_use_builder")
                .eq("user_id", access.user.id).maybeSingle()
            if (!grant.data?.can_use_builder) return NextResponse.json({ error: "No CSV Builder access." }, { status: 403 })
        }
        const form = await request.formData()
        const file = form.get("file")
        const name = String(form.get("name") ?? "").trim().slice(0, 120)
        const phoneColumn = String(form.get("phoneColumn") ?? "")
        const consent = form.get("consent") === "true"
        const requestedColumns: unknown = JSON.parse(String(form.get("columns") ?? "[]"))
        if (!(file instanceof File) || file.size > 10_000_000 || !name || !Array.isArray(requestedColumns)) {
            return NextResponse.json({ error: "Choose a CSV under 10 MB and name the audience." }, { status: 400 })
        }
        const parsed = parseCsv(await file.text())
        const columns = Array.from(new Set(requestedColumns.filter((column): column is string => typeof column === "string")))
        if (!parsed.headers.includes(phoneColumn) || !columns.length || columns.some((column) => !parsed.headers.includes(column))) {
            return NextResponse.json({ error: "Choose a valid phone column and CSV fields." }, { status: 400 })
        }
        if (parsed.rows.length > 50_000 || parsed.headers.length > 50) {
            return NextResponse.json({ error: "This file is too large. Use at most 50,000 rows and 50 columns." }, { status: 400 })
        }
        const { data: audience, error } = await admin.from("whatsapp_audiences").insert({
            name, source: "upload", columns, filters: { phoneColumn, consentAttested: consent },
            created_by: access.user.id,
        }).select("id").single()
        if (error || !audience) throw new Error(error?.message ?? "Could not create audience.")
        try {
            const phoneIndex = parsed.headers.indexOf(phoneColumn)
            const distinct = new Map<string, { audience_id: string; phone: string; consent: boolean; fields: Record<string, string> }>()
            for (const cells of parsed.rows) {
                const phone = normalizeWhatsAppPhone(cells[phoneIndex] ?? "")
                if (!phone) continue
                const fields = Object.fromEntries(columns.map((column) => [column, (cells[parsed.headers.indexOf(column)] ?? "").slice(0, 500)]))
                distinct.set(phone, { audience_id: audience.id, phone, consent, fields })
            }
            const recipients = [...distinct.values()]
            if (!recipients.length) throw new Error("No valid WhatsApp numbers were found in the chosen column.")
            for (let offset = 0; offset < recipients.length; offset += 500) {
                const inserted = await admin.from("whatsapp_audience_recipients").insert(recipients.slice(offset, offset + 500))
                if (inserted.error) throw new Error(inserted.error.message)
            }
            const updated = await admin.from("whatsapp_audiences").update({
                row_count: recipients.length, consent_count: consent ? recipients.length : 0,
            }).eq("id", audience.id)
            if (updated.error) throw new Error(updated.error.message)
            revalidatePath("/dashboard/whatsapp")
            return NextResponse.json({ audienceId: audience.id, count: recipients.length })
        } catch (insertError) {
            await admin.from("whatsapp_audiences").delete().eq("id", audience.id)
            throw insertError
        }
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import CSV." }, { status: 400 })
    }
}
