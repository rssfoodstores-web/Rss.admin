"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export type AudienceFilters = {
    origin: "all" | "rss" | "admin" | "dashboard"
    registration: "all" | "admin" | "email" | "google" | "phone"
    roles: string[]
    requirements: { consent: boolean; email: boolean; name: boolean; order: boolean; phone: boolean }
    search: string
}
export type AudiencePreviewRow = { rowKey: string; fields: Record<string, string>; phone: string; consent: boolean }
export type AudienceSummary = {
    columns: string[]
    consentCount: number
    createdAt: string
    id: string
    name: string
    rowCount: number
    source: "database" | "upload"
}

const allowedRoles = new Set(["customer", "rider", "merchant", "agent", "admin", "sub_admin", "supa_admin"])
const allowedColumns = new Set(["address", "email", "full_name", "order_number", "order_status", "phone", "registration_method", "roles", "source", "state"])

function cleanFilters(input: AudienceFilters): AudienceFilters {
    const origin = ["all", "rss", "admin", "dashboard"].includes(input.origin) ? input.origin : "all"
    const registration = ["all", "admin", "email", "google", "phone"].includes(input.registration) ? input.registration : "all"
    const requirements = input.requirements ?? { consent: false, email: false, name: true, order: false, phone: true }
    return {
        origin,
        registration,
        roles: Array.isArray(input.roles) ? input.roles.filter((role) => allowedRoles.has(role)) : [],
        requirements: {
            consent: requirements.consent === true,
            email: requirements.email === true,
            name: requirements.name === true,
            order: requirements.order === true,
            phone: requirements.phone === true,
        },
        search: typeof input.search === "string" ? input.search.replace(/[%_]/g, "").trim().slice(0, 100) : "",
    }
}

async function campaignAccess() {
    const access = await requireAdminRouteAccess("whatsapp_center")
    const admin = createAdminClient()
    if (access.primaryRole !== "supa_admin") {
        const { data: grant, error } = await admin.from("whatsapp_access_grants")
            .select("can_send_campaigns").eq("user_id", access.user.id).maybeSingle()
        if (error || !grant?.can_send_campaigns) throw new Error("You do not have permission to manage campaigns.")
    }
    return { admin, actor: access.user.id }
}

function summary(row: Record<string, unknown>): AudienceSummary {
    return {
        columns: Array.isArray(row.columns) ? row.columns.filter((item): item is string => typeof item === "string") : [],
        consentCount: Number(row.consent_count ?? 0),
        createdAt: String(row.created_at),
        id: String(row.id),
        name: String(row.name),
        rowCount: Number(row.row_count ?? 0),
        source: row.source === "upload" ? "upload" : "database",
    }
}

export async function previewDatabaseAudience(input: AudienceFilters, page = 0) {
    try {
        const { admin } = await campaignAccess()
        const filters = cleanFilters(input)
        const safePage = Math.max(0, Math.min(100000, Math.floor(Number(page) || 0)))
        const { data, error } = await admin.rpc("whatsapp_audience_rows", { p_filters: filters })
            .range(safePage * 50, safePage * 50 + 49)
        if (error) return { error: error.message }
        const rows: AudiencePreviewRow[] = (data ?? []).map((row: { row_key: string; fields: Record<string, string>; phone: string; consent: boolean }) => ({
            rowKey: row.row_key,
            fields: row.fields as Record<string, string>,
            phone: row.phone,
            consent: row.consent,
        }))
        return {
            consentCount: Number(data?.[0]?.consent_count ?? 0),
            page: safePage,
            rows,
            total: Number(data?.[0]?.total_count ?? 0),
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not preview this audience." }
    }
}

export async function saveDatabaseAudience(input: { name: string; filters: AudienceFilters; columns: string[] }) {
    try {
        const { admin, actor } = await campaignAccess()
        const columns = Array.from(new Set(input.columns.filter((column) => allowedColumns.has(column))))
        if (!input.name?.trim() || !columns.length) return { error: "Name the audience and select at least one column." }
        const { data: id, error } = await admin.rpc("whatsapp_save_database_audience", {
            p_actor: actor, p_columns: columns, p_filters: cleanFilters(input.filters), p_name: input.name.trim().slice(0, 120),
        })
        if (error) return { error: error.message }
        const result = await admin.from("whatsapp_audiences").select("*").eq("id", id).single()
        if (result.error) return { error: result.error.message }
        revalidatePath("/dashboard/whatsapp")
        return { audience: summary(result.data), success: true as const }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not save this audience." }
    }
}

export async function listSavedAudiences() {
    try {
        const { admin } = await campaignAccess()
        const { data, error } = await admin.from("whatsapp_audiences")
            .select("id,name,source,columns,row_count,consent_count,created_at")
            .order("created_at", { ascending: false }).limit(100)
        return error ? { error: error.message } : { audiences: (data ?? []).map(summary) }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not load saved audiences." }
    }
}

export async function previewSavedAudience(audienceId: string, page = 0) {
    try {
        const { admin } = await campaignAccess()
        const safePage = Math.max(0, Math.floor(Number(page) || 0))
        const { data, error, count } = await admin.from("whatsapp_audience_recipients")
            .select("id,phone,consent,fields", { count: "exact" })
            .eq("audience_id", audienceId).order("id")
            .range(safePage * 50, safePage * 50 + 49)
        if (error) return { error: error.message }
        return {
            rows: (data ?? []).map((row) => ({ rowKey: row.id, phone: row.phone, consent: row.consent, fields: row.fields as Record<string, string> })),
            total: count ?? 0,
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not preview saved audience." }
    }
}

export async function getCampaignReadiness(input: { audienceId: string; templateId: string; mapping: Record<string, string> }) {
    try {
        const { admin } = await campaignAccess()
        const [audience, template] = await Promise.all([
            admin.from("whatsapp_audiences").select("columns,row_count").eq("id", input.audienceId).single(),
            admin.from("whatsapp_templates").select("variables,status").eq("id", input.templateId).single(),
        ])
        if (audience.error || template.error || !audience.data || !template.data) return { error: "Choose a saved audience and approved template." }
        if (template.data.status !== "approved") return { error: "This template is not approved." }
        const variables = Array.isArray(template.data.variables) ? template.data.variables as Array<{ name: string }> : []
        if (variables.some((variable) => !audience.data.columns.includes(input.mapping[variable.name]))) return { ready: 0, total: audience.data.row_count }
        const { data, error } = await admin.rpc("whatsapp_audience_ready_count", {
            p_audience_id: input.audienceId, p_mapping: input.mapping, p_variables: variables,
        })
        return error ? { error: error.message } : { ready: Number(data), total: audience.data.row_count }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not check the recipient details." }
    }
}

export async function queueAudienceCampaign(input: {
    audienceId: string; mapping: Record<string, string>; name: string; requestKey: string; templateId: string
}) {
    try {
        const { admin, actor } = await campaignAccess()
        if (process.env.CAMPAIGN_WORKER_ENABLED !== "true" || !process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) {
            return { error: "The protected campaign worker is not configured." }
        }
        if (!/^[0-9a-f-]{36}$/i.test(input.requestKey)) return { error: "Start a new campaign and try again." }
        const { data: id, error } = await admin.rpc("whatsapp_prepare_campaign", {
            p_actor: actor, p_audience_id: input.audienceId, p_mapping: input.mapping,
            p_name: input.name?.trim().slice(0, 120), p_request_key: input.requestKey, p_template_id: input.templateId,
        })
        if (error) return { error: error.message }
        revalidatePath("/dashboard/whatsapp")
        return { campaignId: id as string, success: true as const }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not queue this campaign." }
    }
}

export async function resumeAudienceCampaign(campaignId: string) {
    try {
        const { admin } = await campaignAccess()
        const [campaign, remaining] = await Promise.all([
            admin.from("whatsapp_campaigns").select("id,status,audience_id").eq("id", campaignId).single(),
            admin.from("whatsapp_campaign_recipients").select("id", { count: "exact", head: true })
                .eq("campaign_id", campaignId).eq("status", "queued"),
        ])
        if (campaign.error || !campaign.data?.audience_id || campaign.data.status !== "failed" || !remaining.count) {
            return { error: "This campaign has no queued recipients to resume." }
        }
        const result = await admin.from("whatsapp_campaigns")
            .update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", campaignId).eq("status", "failed")
        if (result.error) return { error: result.error.message }
        revalidatePath("/dashboard/whatsapp")
        return { success: true as const }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not resume this campaign." }
    }
}
