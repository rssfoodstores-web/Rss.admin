import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone, renderTemplate, sendMetaTemplateMessage, type WhatsAppTemplateVariable } from "@/lib/whatsapp-center"
import { getWhatsAppQuotaStatus, WhatsAppQuotaExceededError } from "@/lib/whatsapp-quota"

type Admin = ReturnType<typeof createAdminClient>
type Recipient = { id: string; phone: string; contact_id: string | null; fields: Record<string, string> }
type Outcome = "failed" | "queued" | "sent" | "skipped" | "uncertain"

export async function isCampaignSchedulerReady(admin: Admin) {
    if (process.env.CAMPAIGN_WORKER_ENABLED !== "true" || !process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) return false
    const { data, error } = await admin.rpc("whatsapp_campaign_scheduler_ready")
    return !error && data === true
}

export async function campaignRecipientCounts(admin: Admin, campaignId: string) {
    const statuses = ["queued", "processing", "sent", "failed", "skipped", "uncertain"] as const
    const results = await Promise.all(statuses.map((status) => admin.from("whatsapp_campaign_recipients")
        .select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", status)))
    const error = results.find((result) => result.error)?.error
    if (error) throw new Error(error.message)
    return Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0])) as Record<typeof statuses[number], number>
}

function sendOutcomeUnknown(error: unknown) {
    return error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)
}

export async function runWhatsAppCampaignBatch(admin: Admin, campaignId: string, batchSize = 5, mode: "automatic" | "manual" = "manual") {
    const { data: campaign, error: campaignError } = await admin.from("whatsapp_campaigns")
        .select("id,template_id,variable_defaults,created_by,status,auto_send").eq("id", campaignId).single()
    if (campaignError || campaign?.status !== "sending") throw new Error("This campaign is not ready to send.")
    if (mode === "automatic" && !campaign.auto_send) return { claimed: 0, pausedForQuota: false, rateLimited: false }
    if (mode === "manual" && campaign.auto_send) throw new Error("Pause automatic sending before running a manual batch.")
    const { data: template, error: templateError } = await admin.from("whatsapp_templates")
        .select("name,language,body,variables,status").eq("id", campaign.template_id).single()
    if (templateError || template?.status !== "approved") {
        await admin.from("whatsapp_campaigns").update({ status: "failed", auto_send: false, last_error: "Template is no longer approved by RSS. Check with Meta before resuming.", last_error_at: new Date().toISOString() }).eq("id", campaignId)
        throw new Error("Template is no longer approved. No recipients were sent.")
    }

    const variables = (Array.isArray(template.variables) ? template.variables : []) as WhatsAppTemplateVariable[]
    const mapping = campaign.variable_defaults as Record<string, string>
    const { data, error } = await admin.rpc("whatsapp_claim_campaign_recipients", { p_campaign_id: campaignId, p_limit: Math.min(Math.max(batchSize, 1), 5) })
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as Recipient[]
    if (!batch.length) return { claimed: 0, pausedForQuota: false }

    const { data: contacts, error: contactsError } = await admin.from("whatsapp_contacts")
        .select("id,phone,opted_in,is_active").in("phone", batch.map((row) => row.phone))
    if (contactsError) throw new Error(contactsError.message)
    const contactByPhone = new Map((contacts ?? []).map((row) => [row.phone, row]))
    let pausedForQuota = false
    let rateLimited = false
    let claimed = 0
    let lastError: string | null = null

    for (const row of batch) {
        const { data: currentCampaign, error: statusError } = await admin.from("whatsapp_campaigns").select("status").eq("id", campaignId).single()
        if (statusError) throw new Error("Could not confirm the campaign is still active.")
        const contact = contactByPhone.get(row.phone)
        const values = variables.map((variable) => row.fields[mapping[variable.name]]?.trim() ?? "")
        const phone = normalizeWhatsAppPhone(row.phone)
        let result: Outcome = "queued"
        let errorMessage: string | null = null
        let externalId: string | null = null

        if (currentCampaign.status !== "sending") {
            result = "skipped"; errorMessage = "Campaign cancelled before this message was sent."
        } else if (pausedForQuota || rateLimited) {
            errorMessage = pausedForQuota ? "Waiting for the next RSS send slot." : "Paused after Meta rate-limited this campaign."
        } else if (contact && (!contact.opted_in || !contact.is_active)) {
            result = "skipped"; errorMessage = "Contact withdrew WhatsApp permission or became inactive."
        } else if (!phone || values.some((value) => !value)) {
            result = "skipped"; errorMessage = "Phone number or template information is missing."
        } else {
            try {
                externalId = await sendMetaTemplateMessage({ language: template.language, name: template.name, phone, values })
                result = "sent"
            } catch (sendError) {
                if (sendError instanceof WhatsAppQuotaExceededError) {
                    pausedForQuota = true
                    errorMessage = "Waiting for the next RSS send slot."
                } else if (sendOutcomeUnknown(sendError)) {
                    result = "uncertain"
                    errorMessage = "Meta's response was not received. Do not retry until this recipient is checked."
                } else {
                    result = "failed"
                    errorMessage = sendError instanceof Error ? sendError.message : "Meta rejected this message."
                    if (/rate.limit|throttl|too many|capacity|quota/i.test(errorMessage)) rateLimited = true
                }
            }
        }

        if (result === "sent") {
            const rendered = renderTemplate(template.body, Object.fromEntries(variables.map((variable, i) => [variable.name, values[i]])))
            const { error: logError } = await admin.from("whatsapp_messages").insert({
                body: rendered, campaign_id: campaignId, contact_id: contact?.id ?? row.contact_id,
                direction: "outbound", external_message_id: externalId, message_type: "template",
                metadata: { phone: row.phone, campaign_recipient_id: row.id },
                sent_by: campaign.created_by, status: "sent",
            })
            if (logError) {
                // Meta accepted the send. Keep it uncertain instead of risking a duplicate retry.
                result = "uncertain"
                errorMessage = "Meta accepted this message, but the RSS message log failed. Check before retrying."
            }
        }
        if (result === "failed" || result === "uncertain") lastError = errorMessage
        const { error: updateError } = await admin.from("whatsapp_campaign_recipients")
            .update({ status: result, error_message: errorMessage, external_message_id: externalId, updated_at: new Date().toISOString() })
            .eq("id", row.id).eq("status", "processing")
        if (updateError) throw new Error(updateError.message)
        if (result !== "queued") claimed += 1
    }

    const latest = await campaignRecipientCounts(admin, campaignId)
    if (!pausedForQuota && latest.queued + latest.processing > 0) {
        const quota = await getWhatsAppQuotaStatus()
        if (quota.remaining === 0) pausedForQuota = true
    }
    const status = rateLimited ? "failed" : latest.queued + latest.processing === 0 ? (latest.uncertain ? "failed" : latest.sent ? "completed" : "failed") : "sending"
    const update: Record<string, unknown> = {
        sent_count: latest.sent, failed_count: latest.failed, skipped_count: latest.skipped + latest.uncertain,
        status, last_worker_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (status !== "sending" || pausedForQuota || rateLimited) update.auto_send = false
    if (pausedForQuota) {
        update.last_error = "RSS send allowance full. The remaining people are waiting for an admin to continue after the countdown."
        update.last_error_at = new Date().toISOString()
    } else if (lastError || rateLimited) {
        update.last_error = lastError ?? "Meta rate-limited this campaign."
        update.last_error_at = new Date().toISOString()
    } else if (campaign.auto_send || mode === "manual") {
        update.last_error = null
        update.last_error_at = null
    }
    const { data: updatedCampaign, error: campaignUpdateError } = await admin.from("whatsapp_campaigns")
        .update(update).eq("id", campaignId).eq("status", "sending").select("id").maybeSingle()
    if (campaignUpdateError) throw new Error(campaignUpdateError.message)
    if (!updatedCampaign) {
        // A cancellation can race with one request already in flight. Preserve the cancelled state while showing its final counts.
        const cancelledUpdate = await admin.from("whatsapp_campaigns")
            .update({ sent_count: latest.sent, failed_count: latest.failed, skipped_count: latest.skipped + latest.uncertain, updated_at: new Date().toISOString() })
            .eq("id", campaignId).eq("status", "cancelled")
        if (cancelledUpdate.error) throw new Error(cancelledUpdate.error.message)
    }
    return { claimed, pausedForQuota, rateLimited }
}

export async function recordCampaignWorkerFailure(admin: Admin, campaignId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Background worker failed."
    await admin.from("whatsapp_campaign_recipients")
        .update({ status: "uncertain", error_message: "Worker stopped during this recipient. Check before retrying.", updated_at: new Date().toISOString() })
        .eq("campaign_id", campaignId).eq("status", "processing")
    await admin.from("whatsapp_campaigns").update({
        status: "failed", auto_send: false, last_error: message.slice(0, 500), last_error_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", campaignId).eq("status", "sending")
}
