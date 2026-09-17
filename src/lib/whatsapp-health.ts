import "server-only"

import type { WhatsAppTemplateRecord } from "@/app/dashboard/whatsapp/actions"

export interface MetaTemplateHealth {
    name: string
    language: string
    category: string
    status: string
    quality: string | null
    rejectionReason: string | null
}

export interface WhatsAppHealthSnapshot {
    checkedAt: string
    phone: { display: string | null; verifiedName: string | null; verification: string | null; quality: string | null; status: string | null; error: string | null }
    account: { name: string | null; messagingLimit: string | null; error: string | null }
    templates: { items: MetaTemplateHealth[]; error: string | null; truncated: boolean; localOnly: string[] }
    rss: { connectionActive: boolean; campaignWorkerConfigured: boolean; deliveryTracking: string; consentTracking: string }
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

function string(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null
}

async function graphGet(version: string, path: string, fields: string, token: string, after?: string): Promise<JsonRecord> {
    const url = new URL(`https://graph.facebook.com/${encodeURIComponent(version)}/${path}`)
    url.searchParams.set("fields", fields)
    if (after) url.searchParams.set("after", after)
    if (path.endsWith("/message_templates")) url.searchParams.set("limit", "250")
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
    })
    const body = record(await response.json().catch(() => ({})))
    if (!response.ok) {
        const error = record(body.error)
        // Do not return provider payloads verbatim: they could contain account identifiers or secrets.
        throw new Error(`Meta returned HTTP ${response.status}${typeof error.code === "number" ? ` (code ${error.code})` : ""}. Check the Meta token permissions and IDs.`)
    }
    return body
}

export async function readWhatsAppHealth(input: {
    version: string
    token: string
    wabaId: string | null
    phoneId: string
    connectionActive: boolean
    campaignWorkerConfigured: boolean
    localTemplates: WhatsAppTemplateRecord[]
}): Promise<WhatsAppHealthSnapshot> {
    const snapshot: WhatsAppHealthSnapshot = {
        checkedAt: new Date().toISOString(),
        phone: { display: null, verifiedName: null, verification: null, quality: null, status: null, error: null },
        account: { name: null, messagingLimit: null, error: null },
        templates: { items: [], error: null, truncated: false, localOnly: [] },
        rss: {
            connectionActive: input.connectionActive,
            campaignWorkerConfigured: input.campaignWorkerConfigured,
            deliveryTracking: "Not verified — RSS has not confirmed Meta delivery-status webhooks.",
            consentTracking: "Not verified — an opted-in flag alone is not proof of when or how permission was given.",
        },
    }
    const jobs: Promise<void>[] = []
    jobs.push((async () => {
        if (!input.phoneId) { snapshot.phone.error = "Phone number ID is missing."; return }
        try {
            const row = await graphGet(input.version, encodeURIComponent(input.phoneId), "display_phone_number,verified_name,code_verification_status,quality_rating,status", input.token)
            snapshot.phone = { display: string(row.display_phone_number), verifiedName: string(row.verified_name), verification: string(row.code_verification_status), quality: string(row.quality_rating), status: string(row.status), error: null }
        } catch {
            try {
                const row = await graphGet(input.version, encodeURIComponent(input.phoneId), "display_phone_number,verified_name,code_verification_status,quality_rating", input.token)
                snapshot.phone = { display: string(row.display_phone_number), verifiedName: string(row.verified_name), verification: string(row.code_verification_status), quality: string(row.quality_rating), status: null, error: null }
            } catch (error) { snapshot.phone.error = error instanceof Error ? error.message : "Meta phone check failed." }
        }
    })())
    jobs.push((async () => {
        if (!input.wabaId) { snapshot.account.error = "WhatsApp Business Account ID is missing."; return }
        try {
            const row = await graphGet(input.version, encodeURIComponent(input.wabaId), "name,whatsapp_business_manager_messaging_limit", input.token)
            snapshot.account.name = string(row.name)
            snapshot.account.messagingLimit = string(row.whatsapp_business_manager_messaging_limit)
        } catch {
            try {
                const row = await graphGet(input.version, encodeURIComponent(input.wabaId), "name", input.token)
                snapshot.account.name = string(row.name)
                snapshot.account.error = "Meta did not return the messaging limit for this token/account. Check it in WhatsApp Manager."
            } catch (error) { snapshot.account.error = error instanceof Error ? error.message : "Meta account check failed." }
        }
    })())
    jobs.push((async () => {
        if (!input.wabaId) { snapshot.templates.error = "WhatsApp Business Account ID is missing."; return }
        try {
            let after: string | undefined
            for (let page = 0; page < 4; page++) {
                let body: JsonRecord
                try {
                    body = await graphGet(input.version, `${encodeURIComponent(input.wabaId)}/message_templates`, "name,language,category,status,quality_score,rejected_reason", input.token, after)
                } catch {
                    body = await graphGet(input.version, `${encodeURIComponent(input.wabaId)}/message_templates`, "name,language,category,status,rejected_reason", input.token, after)
                }
                for (const item of Array.isArray(body.data) ? body.data : []) {
                    const row = record(item)
                    const quality = record(row.quality_score)
                    if (!string(row.name)) continue
                    snapshot.templates.items.push({
                        name: string(row.name)!, language: string(row.language) ?? "Unknown", category: string(row.category) ?? "Unknown",
                        status: string(row.status) ?? "Unknown", quality: string(quality.score) ?? string(row.quality_score),
                        rejectionReason: string(row.rejected_reason),
                    })
                }
                const paging = record(body.paging)
                const cursors = record(paging.cursors)
                const next = string(cursors.after)
                if (!string(paging.next) || !next) break
                if (page === 3) { snapshot.templates.truncated = true; break }
                after = next
            }
            const names = new Set(snapshot.templates.items.map((item) => `${item.name}:${item.language.toLowerCase()}`))
            snapshot.templates.localOnly = input.localTemplates.filter((item) => item.status !== "draft" && !names.has(`${item.name}:${item.language.toLowerCase()}`)).map((item) => item.name)
        } catch (error) { snapshot.templates.error = error instanceof Error ? error.message : "Meta template check failed." }
    })())
    await Promise.all(jobs)
    return snapshot
}
