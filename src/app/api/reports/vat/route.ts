import { createClient } from "@/lib/supabase/server"
import { normalizeAssignablePermissionKeys } from "@/lib/admin-routes"

function escapeCsv(value: string | number | null | undefined) {
    const stringValue = value == null ? "" : String(value)

    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, "\"\"")}"`
    }

    return stringValue
}

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return new Response("Unauthorized", { status: 401 })
    }

    const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)

    const roleNames = (roles ?? []).map((row) => row.role)
    const isFullAdmin = roleNames.includes("admin") || roleNames.includes("supa_admin")

    let canExport = isFullAdmin

    if (!canExport && roleNames.includes("sub_admin")) {
        const { data: permissionRows } = await supabase
            .from("admin_dashboard_permissions")
            .select("permission_key")
            .eq("user_id", user.id)

        const assignedPermissions = normalizeAssignablePermissionKeys(
            (permissionRows ?? []).map((row) => String(row.permission_key ?? ""))
        )

        canExport = assignedPermissions.includes("reports")
    }

    if (!canExport) {
        return new Response("Forbidden", { status: 403 })
    }

    const url = new URL(request.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    let query = supabase
        .from("tax_liabilities")
        .select("order_id, taxable_base_kobo, vat_amount_kobo, vat_bps, status, created_at")
        .order("created_at", { ascending: false })

    if (from) {
        query = query.gte("created_at", `${from}T00:00:00.000Z`)
    }

    if (to) {
        query = query.lte("created_at", `${to}T23:59:59.999Z`)
    }

    const { data, error } = await query

    if (error) {
        return new Response(error.message, { status: 500 })
    }

    const rows = [
        ["order_id", "taxable_base_kobo", "vat_amount_kobo", "vat_bps", "status", "created_at"].join(","),
        ...(data ?? []).map((row) => [
            escapeCsv(row.order_id),
            escapeCsv(row.taxable_base_kobo),
            escapeCsv(row.vat_amount_kobo),
            escapeCsv(row.vat_bps),
            escapeCsv(row.status),
            escapeCsv(row.created_at),
        ].join(",")),
    ]

    return new Response(rows.join("\n"), {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="vat-report${from || to ? `-${from || "start"}-${to || "latest"}` : ""}.csv"`,
        },
    })
}
