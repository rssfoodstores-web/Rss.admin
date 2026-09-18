"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { campaignRecipientCounts, isCampaignSchedulerReady, recordCampaignWorkerFailure, runWhatsAppCampaignBatch } from "@/lib/whatsapp-campaign-worker"
import { getWhatsAppQuotaStatus } from "@/lib/whatsapp-quota"

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

async function audienceAccess(capability: "builder" | "campaigns" | "either") {
    const access = await requireAdminRouteAccess("whatsapp_center")
    const admin = createAdminClient()
    if (access.primaryRole !== "supa_admin") {
        const { data: grant, error } = await admin.from("whatsapp_access_grants")
            .select("can_send_campaigns,can_use_builder").eq("user_id", access.user.id).maybeSingle()
        const allowed = capability === "builder" ? grant?.can_use_builder
            : capability === "campaigns" ? grant?.can_send_campaigns
            : grant?.can_use_builder || grant?.can_send_campaigns
        if (error || !allowed) throw new Error("You do not have permission for this WhatsApp tab.")
    }
    return { admin, actor: access.user.id }
}

const campaignAccess = () => audienceAccess("campaigns")
const builderAccess = () => audienceAccess("builder")
const audienceListAccess = () => audienceAccess("either")

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
        const { admin } = await builderAccess()
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
        const { admin, actor } = await builderAccess()
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
        const { admin } = await audienceListAccess()
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
        const { admin } = await audienceListAccess()
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

export async function runTestCampaignBatch(campaignId: string) {
    const { admin } = await campaignAccess()
    const { data: campaign, error } = await admin.from("whatsapp_campaigns")
        .select("id,status,audience_id,auto_send,last_worker_run_at,sent_count").eq("id", campaignId).single()
    if (error || !campaign?.audience_id || campaign.status !== "sending" || campaign.auto_send) return { error: "Pause automatic sending before running a manual test batch." }
    if (campaign.last_worker_run_at && campaign.sent_count > 0) return { error: "The first test batch has already run. Choose the next number or automatic sending." }
    try {
        const result = await runWhatsAppCampaignBatch(admin, campaignId, 5)
        revalidatePath("/dashboard/whatsapp")
        return { success: true as const, processed: result.claimed, pausedForQuota: result.pausedForQuota, rateLimited: result.rateLimited }
    } catch (runError) {
        await recordCampaignWorkerFailure(admin, campaignId, runError)
        revalidatePath("/dashboard/whatsapp")
        return { error: "The batch stopped. Open campaign problems to see why; no automatic retry was started." }
    }
}

export async function runManualCampaignBatch(campaignId: string, count: number) {
    const { admin } = await campaignAccess()
    if (!Number.isSafeInteger(count) || count < 1 || count > 5) return { error: "Choose between 1 and 5 people for each batch." }
    const { data: campaign, error } = await admin.from("whatsapp_campaigns")
        .select("id,status,audience_id,auto_send,last_worker_run_at,sent_count").eq("id", campaignId).single()
    if (error || !campaign?.audience_id || campaign.status !== "sending" || campaign.auto_send || !campaign.last_worker_run_at || campaign.sent_count < 1) {
        return { error: "Run the first 5-person test before choosing another manual batch." }
    }
    try {
        const result = await runWhatsAppCampaignBatch(admin, campaignId, count)
        revalidatePath("/dashboard/whatsapp")
        return { success: true as const, processed: result.claimed, pausedForQuota: result.pausedForQuota, rateLimited: result.rateLimited }
    } catch (runError) {
        await recordCampaignWorkerFailure(admin, campaignId, runError)
        revalidatePath("/dashboard/whatsapp")
        return { error: "The batch stopped. Open campaign problems to see why; no automatic retry was started." }
    }
}

export async function setCampaignAutoSend(campaignId: string, enabled: boolean) {
    const { admin } = await campaignAccess()
    if (enabled && !(await isCampaignSchedulerReady(admin))) {
        return { error: "Automatic sending is not configured on the server. Continue with confirmed manual batches for now." }
    }
    if (enabled) {
        const [{ data: campaign, error }, quota] = await Promise.all([
            admin.from("whatsapp_campaigns").select("last_worker_run_at,sent_count").eq("id", campaignId).single(),
            getWhatsAppQuotaStatus(),
        ])
        if (error || !campaign?.last_worker_run_at || campaign.sent_count < 1) return { error: "Send and review the first 5-person test before enabling automatic batches." }
        if (quota.remaining < 1) return { error: "RSS allowance is full. Wait for the countdown, then an admin must continue manually." }
    }
    const { data, error } = await admin.from("whatsapp_campaigns")
        .update({ auto_send: enabled, updated_at: new Date().toISOString() })
        .eq("id", campaignId).eq("status", "sending").not("audience_id", "is", null).select("id").maybeSingle()
    if (error || !data) return { error: "This campaign cannot be changed right now." }
    revalidatePath("/dashboard/whatsapp")
    return { success: true as const }
}

export async function cancelAudienceCampaign(campaignId: string) {
    try {
        const { admin } = await campaignAccess()
        const { data, error } = await admin.from("whatsapp_campaigns")
            .update({ status: "cancelled", auto_send: false, updated_at: new Date().toISOString() })
            .eq("id", campaignId).in("status", ["sending", "failed"]).not("audience_id", "is", null)
            .select("id").maybeSingle()
        if (error || !data) return { error: "This campaign cannot be cancelled now." }
        const stopped = await admin.from("whatsapp_campaign_recipients")
            .update({ status: "skipped", error_message: "Campaign cancelled by an admin before sending.", updated_at: new Date().toISOString() })
            .eq("campaign_id", campaignId).eq("status", "queued")
        if (stopped.error) return { error: "Campaign stopped, but some waiting rows could not be marked cancelled. Contact support before using it again." }
        const counts = await campaignRecipientCounts(admin, campaignId)
        const updated = await admin.from("whatsapp_campaigns").update({ sent_count: counts.sent, failed_count: counts.failed, skipped_count: counts.skipped + counts.uncertain }).eq("id", campaignId).eq("status", "cancelled")
        if (updated.error) return { error: "Campaign stopped, but its progress count could not be refreshed. Reload the page before taking another action." }
        revalidatePath("/dashboard/whatsapp")
        return { success: true as const }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not cancel this campaign." }
    }
}

export async function getCampaignProblems(campaignId: string) {
    try {
        const { admin } = await campaignAccess()
        const [campaign, recipients] = await Promise.all([
            admin.from("whatsapp_campaigns").select("last_error,last_error_at,last_worker_run_at").eq("id", campaignId).single(),
            admin.from("whatsapp_campaign_recipients")
                .select("phone,status,error_message,updated_at", { count: "exact" })
                .eq("campaign_id", campaignId).in("status", ["failed", "skipped", "uncertain"])
                .order("updated_at", { ascending: false }).limit(30),
        ])
        if (campaign.error || recipients.error || !campaign.data) return { error: "Could not load campaign problems." }
        return {
            lastError: campaign.data.last_error as string | null,
            lastErrorAt: campaign.data.last_error_at as string | null,
            lastWorkerRunAt: campaign.data.last_worker_run_at as string | null,
            total: recipients.count ?? 0,
            problems: (recipients.data ?? []).map((row) => ({
                phone: `••••${row.phone.slice(-4)}`,
                status: row.status as string,
                reason: row.error_message ?? "No reason was recorded.",
                updatedAt: row.updated_at as string,
            })),
        }
    } catch {
        return { error: "Could not load campaign problems." }
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
            .update({ status: "sending", auto_send: false, last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq("id", campaignId).eq("status", "failed")
        if (result.error) return { error: result.error.message }
        revalidatePath("/dashboard/whatsapp")
        return { success: true as const }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not resume this campaign." }
    }
}
