import { NextRequest, NextResponse } from "next/server"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"

function csvCell(value: string) {
    const safe = /^[=+@\-\t\r]/.test(value) ? "'" + value : value
    return '"' + safe.replace(/"/g, '""') + '"'
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireAdminRouteAccess("whatsapp_center")
    const admin = createAdminClient()
    if (access.primaryRole !== "supa_admin") {
        const grant = await admin.from("whatsapp_access_grants").select("can_use_builder")
            .eq("user_id", access.user.id).maybeSingle()
        if (!grant.data?.can_use_builder) return NextResponse.json({ error: "No CSV Builder access." }, { status: 403 })
    }
    const { id } = await params
    const { data: audience, error } = await admin.from("whatsapp_audiences")
        .select("name,columns").eq("id", id).single()
    if (error || !audience) return NextResponse.json({ error: "Audience not found." }, { status: 404 })
    const lines: string[] = [audience.columns.map(csvCell).join(",")]
    for (let from = 0; ; from += 500) {
        const result = await admin.from("whatsapp_audience_recipients")
            .select("fields").eq("audience_id", id).order("id").range(from, from + 499)
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
        for (const row of result.data ?? []) {
            const fields = row.fields as Record<string, string>
            lines.push(audience.columns.map((column: string) => csvCell(String(fields[column] ?? ""))).join(","))
        }
        if ((result.data ?? []).length < 500) break
    }
    const filename = audience.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "rss-audience"
    return new NextResponse("\uFEFF" + lines.join("\r\n"), {
        headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": `attachment; filename="${filename}.csv"`,
            "Content-Type": "text/csv; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        },
    })
}
