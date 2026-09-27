import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminRouteKey } from "@/lib/admin-routes"

export type AdminActivityItem = {
    id: string
    kind: "approval" | "location" | "support"
    title: string
    description: string
    href: string
    createdAt: string | null
}

export type AdminActivitySnapshot = {
    total: number
    counts: Partial<Record<AdminRouteKey, number>>
    items: AdminActivityItem[]
}

type PendingRow = { id: string; created_at?: string | null }
type NamedPendingRow = PendingRow & { name?: string | null; store_name?: string | null }

export async function getAdminActivitySnapshot(
    supabase: SupabaseClient,
    allowedRouteKeys: AdminRouteKey[]
): Promise<AdminActivitySnapshot> {
    const canSee = (key: AdminRouteKey) => allowedRouteKeys.includes(key)

    const [productsResult, ridersResult, merchantsResult, agentsResult, locationsResult, supportResult] = await Promise.all([
        canSee("approvals")
            ? supabase.from("products").select("id, name, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        canSee("approvals")
            ? supabase.from("rider_profiles").select("id, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        canSee("approvals")
            ? supabase.from("merchants").select("id, store_name, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        canSee("approvals")
            ? supabase.from("agent_profiles").select("id, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        canSee("location_access")
            ? supabase.from("profiles").select("id, full_name, location_update_requested_at").eq("update_requested", true).order("location_update_requested_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        canSee("support")
            ? supabase.from("support_conversations").select("id, visitor_name, subject, status, last_message_at").in("status", ["open", "human_follow_up"]).order("last_message_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
    ])

    const riders = (ridersResult.data ?? []) as PendingRow[]
    const agents = (agentsResult.data ?? []) as PendingRow[]
    const profileIds = [...riders, ...agents].map((row) => row.id)
    const profilesResult = profileIds.length
        ? await supabase.from("profiles").select("id, full_name, company_name").in("id", profileIds)
        : { data: [] }
    const profileNames = new Map(
        ((profilesResult.data ?? []) as Array<{ id: string; full_name: string | null; company_name: string | null }>).map((profile) => [
            profile.id,
            profile.full_name?.trim() || profile.company_name?.trim() || "Unnamed applicant",
        ])
    )

    const products = (productsResult.data ?? []) as NamedPendingRow[]
    const merchants = (merchantsResult.data ?? []) as NamedPendingRow[]
    const locations = (locationsResult.data ?? []) as Array<{ id: string; full_name: string | null; location_update_requested_at: string | null }>
    const support = (supportResult.data ?? []) as Array<{ id: string; visitor_name: string | null; subject: string | null; last_message_at: string | null }>
    const approvalCount = products.length + riders.length + merchants.length + agents.length

    const items: AdminActivityItem[] = [
        ...riders.map((row) => ({ id: `rider:${row.id}`, kind: "approval" as const, title: "Rider documents need review", description: profileNames.get(row.id) ?? "Unnamed rider", href: "/dashboard/approvals#rider-approvals", createdAt: row.created_at ?? null })),
        ...merchants.map((row) => ({ id: `merchant:${row.id}`, kind: "approval" as const, title: "Merchant application needs review", description: row.store_name?.trim() || "Unnamed merchant", href: "/dashboard/approvals#merchant-approvals", createdAt: row.created_at ?? null })),
        ...agents.map((row) => ({ id: `agent:${row.id}`, kind: "approval" as const, title: "Agent application needs review", description: profileNames.get(row.id) ?? "Unnamed agent", href: "/dashboard/approvals#agent-approvals", createdAt: row.created_at ?? null })),
        ...products.map((row) => ({ id: `product:${row.id}`, kind: "approval" as const, title: "Product price needs approval", description: row.name?.trim() || "Unnamed product", href: "/dashboard/approvals#pricing-approvals", createdAt: row.created_at ?? null })),
        ...locations.map((row) => ({ id: `location:${row.id}`, kind: "location" as const, title: "Store location request", description: row.full_name?.trim() || "Merchant requested location access", href: "/dashboard/location-access#pending-location-requests", createdAt: row.location_update_requested_at })),
        ...support.map((row) => ({ id: `support:${row.id}`, kind: "support" as const, title: "Support conversation needs attention", description: row.visitor_name?.trim() || row.subject?.trim() || "Open customer conversation", href: `/dashboard/support?conversation=${encodeURIComponent(row.id)}`, createdAt: row.last_message_at })),
    ].sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0)).slice(0, 30)

    const counts: Partial<Record<AdminRouteKey, number>> = {}
    if (canSee("approvals")) counts.approvals = approvalCount
    if (canSee("location_access")) counts.location_access = locations.length
    if (canSee("support")) counts.support = support.length

    return {
        total: Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0),
        counts,
        items,
    }
}
