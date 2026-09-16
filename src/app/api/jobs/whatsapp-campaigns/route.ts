import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone, renderTemplate, sendMetaTemplateMessage, type WhatsAppTemplateVariable } from "@/lib/whatsapp-center"

export const maxDuration = 300
export const dynamic = "force-dynamic"

type Recipient = {
    id: string; phone: string; contact_id: string | null; fields: Record<string, string>
}

async function counts(admin: ReturnType<typeof createAdminClient>, campaignId: string) {
    const statuses = ["queued", "processing", "sent", "failed", "skipped", "uncertain"] as const
    const results = await Promise.all(statuses.map((status) => admin.from("whatsapp_campaign_recipients")
        .select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", status)))
    const error = results.find((result) => result.error)?.error
    if (error) throw new Error(error.message)
    return Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0])) as Record<typeof statuses[number], number>
}

async function processCampaign(admin: ReturnType<typeof createAdminClient>, campaignId: string) {
    const { data: campaign, error: campaignError } = await admin.from("whatsapp_campaigns")
        .select("id,template_id,variable_defaults,created_by,status").eq("id", campaignId).single()
    if (campaignError || campaign?.status !== "sending") return
    const { data: template, error: templateError } = await admin.from("whatsapp_templates")
        .select("name,language,body,variables,status").eq("id", campaign.template_id).single()
    if (templateError || template?.status !== "approved") {
        await admin.from("whatsapp_campaigns").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", campaignId)
        return
    }
    const variables = (Array.isArray(template.variables) ? template.variables : []) as WhatsAppTemplateVariable[]
    const mapping = campaign.variable_defaults as Record<string, string>
    let processed = 0
    const started = Date.now()
    let rateLimited = false
    while (processed < 100 && Date.now() - started < 170_000 && !rateLimited) {
        const { data, error } = await admin.rpc("whatsapp_claim_campaign_recipients", { p_campaign_id: campaignId, p_limit: 20 })
        if (error) throw new Error(error.message)
        const batch = (data ?? []) as Recipient[]
        if (!batch.length) break
        processed += batch.length
        const phones = batch.map((row) => row.phone)
        const { data: contacts, error: contactsError } = await admin.from("whatsapp_contacts")
            .select("id,phone,opted_in,is_active").in("phone", phones)
        if (contactsError) throw new Error(contactsError.message)
        const contactByPhone = new Map((contacts ?? []).map((row) => [row.phone, row]))
        for (let offset = 0; offset < batch.length; offset += 5) {
            const chunk = batch.slice(offset, offset + 5)
            await Promise.all(chunk.map(async (row) => {
                const contact = contactByPhone.get(row.phone)
                const values = variables.map((variable) => row.fields[mapping[variable.name]]?.trim() ?? "")
                const phone = normalizeWhatsAppPhone(row.phone)
                let result: "sent" | "failed" | "skipped" = "sent"
                let errorMessage: string | null = null
                let externalId: string | null = null
                if (contact && (!contact.opted_in || !contact.is_active)) {
                    result = "skipped"; errorMessage = "Contact withdrew consent or became inactive."
                } else if (!phone || values.some((value) => !value)) {
                    result = "skipped"; errorMessage = "Phone or template information is missing."
                } else {
                    try {
                        externalId = await sendMetaTemplateMessage({
                            language: template.language, name: template.name, phone, values,
                        })
                    } catch (sendError) {
                        result = "failed"
                        errorMessage = sendError instanceof Error ? sendError.message : "Meta could not send the message."
                        if (/rate.limit|throttl|too many|capacity|quota/i.test(errorMessage)) rateLimited = true
                    }
                }
                const rendered = renderTemplate(template.body, Object.fromEntries(variables.map((variable, i) => [variable.name, values[i]])))
                if (result === "sent") {
                    await admin.from("whatsapp_messages").insert({
                        body: rendered, campaign_id: campaignId, contact_id: contact?.id ?? row.contact_id,
                        direction: "outbound", external_message_id: externalId, message_type: "template",
                        metadata: { phone: row.phone, campaign_recipient_id: row.id },
                        sent_by: campaign.created_by, status: "sent",
                    })
                }
                const { error: updateError } = await admin.from("whatsapp_campaign_recipients")
                    .update({ status: result, error_message: errorMessage, external_message_id: externalId, updated_at: new Date().toISOString() })
                    .eq("id", row.id).eq("status", "processing")
                if (updateError) throw new Error(updateError.message)
            }))
        }
    }
    const latest = await counts(admin, campaignId)
    await admin.from("whatsapp_campaigns").update({
        sent_count: latest.sent, failed_count: latest.failed, skipped_count: latest.skipped + latest.uncertain,
        status: rateLimited ? "failed" : latest.queued + latest.processing === 0 ? (latest.sent ? "completed" : "failed") : "sending",
        updated_at: new Date().toISOString(),
    }).eq("id", campaignId)
}

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET
    if (process.env.CAMPAIGN_WORKER_ENABLED !== "true" || !secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const admin = createAdminClient()
        // A timed-out request may have reached Meta. Never automatically send it again.
        await admin.from("whatsapp_campaign_recipients")
            .update({ status: "uncertain", error_message: "Send outcome unknown after worker interruption. Reconcile before retrying." })
            .eq("status", "processing").lt("claimed_at", new Date(Date.now() - 15 * 60_000).toISOString())
        const { data: campaigns, error } = await admin.from("whatsapp_campaigns").select("id")
            .eq("status", "sending").not("audience_id", "is", null).order("created_at").limit(1)
        if (error) throw new Error(error.message)
        if (campaigns?.[0]) {
            await processCampaign(admin, campaigns[0].id)
            revalidatePath("/dashboard/whatsapp")
        }
        return NextResponse.json({ processedCampaign: campaigns?.[0]?.id ?? null })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign worker failed." }, { status: 500 })
    }
}
