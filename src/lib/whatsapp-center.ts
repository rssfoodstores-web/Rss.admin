import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidE164PhoneNumber, normalizePhoneNumber } from "@/lib/phone"
import { reserveWhatsAppRecipient } from "@/lib/whatsapp-quota"

export type WhatsAppAccessLevel = "manager" | "operator"
export type WhatsAppCapability = "builder" | "campaigns" | "contacts" | "health" | "home" | "messages" | "settings" | "templates"

export interface WhatsAppAccess {
    accessLevel: WhatsAppAccessLevel | "owner"
    canManageContacts: boolean
    canManageSettings: boolean
    canManageTemplates: boolean
    canSendCampaigns: boolean
    canSendMessages: boolean
    canUseBuilder: boolean
    canViewHealth: boolean
    canViewHome: boolean
}

export interface WhatsAppTemplateVariable {
    example: string
    name: string
}

interface ConnectionRow {
    api_base_url: string
    api_token_ciphertext: string
    graph_api_version: string
    is_active: boolean
    meta_access_token_ciphertext: string | null
    phone_number_id: string
    waba_id: string | null
}

export interface WhatsAppConnectionSecrets {
    apiBaseUrl: string
    apiToken: string
    graphApiVersion: string
    isActive: boolean
    metaAccessToken: string | null
    phoneNumberId: string
    wabaId: string | null
}

interface ProviderResponse {
    message?: unknown
    status?: unknown
    wa_message_id?: unknown
    [key: string]: unknown
}

function getEncryptionKey() {
    const secret = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY
        ?? process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!secret) {
        throw new Error("WhatsApp credential encryption is not configured.")
    }

    return createHash("sha256").update(secret).digest()
}

export function encryptCredential(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()

    return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":")
}

export function decryptCredential(value: string) {
    const [version, ivValue, tagValue, encryptedValue] = value.split(":")

    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
        throw new Error("The stored WhatsApp credential is invalid.")
    }

    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64"))
    decipher.setAuthTag(Buffer.from(tagValue, "base64"))

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64")),
        decipher.final(),
    ]).toString("utf8")
}

export function normalizeWhatsAppPhone(value: string) {
    const normalized = normalizePhoneNumber(value)
    return isValidE164PhoneNumber(normalized) ? normalized : null
}

export function extractTemplateVariables(body: string): WhatsAppTemplateVariable[] {
    const names = Array.from(body.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g), (match) => match[1])

    return Array.from(new Set(names)).map((name) => ({
        example: name === "customer_name" ? "Ada" : `Sample ${name.replace(/_/g, " ")}`,
        name,
    }))
}

export function renderTemplate(body: string, values: Record<string, string>) {
    return body.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => values[name] ?? `{{${name}}}`)
}

function assertWhatChimpBaseUrl(value: string) {
    const url = new URL(value)

    if (url.protocol !== "https:" || url.hostname !== "app.whatchimp.com") {
        throw new Error("For security, the API URL must use https://app.whatchimp.com.")
    }

    return url.toString().replace(/\/$/, "")
}

async function parseProviderResponse(response: Response): Promise<ProviderResponse> {
    const text = await response.text()

    if (!text) {
        return {}
    }

    try {
        return JSON.parse(text) as ProviderResponse
    } catch {
        return { message: text }
    }
}

function getProviderMessage(payload: ProviderResponse, fallback: string) {
    return typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : fallback
}

export async function loadWhatsAppConnection(adminSupabase = createAdminClient()) {
    const { data, error } = await adminSupabase
        .from("whatsapp_connections")
        .select("api_base_url, api_token_ciphertext, graph_api_version, is_active, meta_access_token_ciphertext, phone_number_id, waba_id")
        .eq("id", "primary")
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    if (!data) {
        throw new Error("Connect WhatChimp in Settings before sending messages.")
    }

    const row = data as ConnectionRow

    return {
        apiBaseUrl: assertWhatChimpBaseUrl(row.api_base_url),
        apiToken: decryptCredential(row.api_token_ciphertext),
        graphApiVersion: row.graph_api_version,
        isActive: row.is_active,
        metaAccessToken: row.meta_access_token_ciphertext
            ? decryptCredential(row.meta_access_token_ciphertext)
            : null,
        phoneNumberId: row.phone_number_id,
        wabaId: row.waba_id,
    } satisfies WhatsAppConnectionSecrets
}

async function postWhatChimp(
    connection: WhatsAppConnectionSecrets,
    path: string,
    values: Record<string, string>
) {
    if (!connection.isActive) {
        throw new Error("The WhatChimp connection is paused.")
    }

    const body = new URLSearchParams({
        apiToken: connection.apiToken,
        phone_number_id: connection.phoneNumberId,
        ...values,
    })
    const response = await fetch(`${connection.apiBaseUrl}${path}`, {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
    })
    const payload = await parseProviderResponse(response)

    if (!response.ok || String(payload.status ?? "0") !== "1") {
        throw new Error(getProviderMessage(payload, `WhatChimp returned HTTP ${response.status}.`))
    }

    return payload
}

export async function testWhatChimpConnection(connection: WhatsAppConnectionSecrets, phone: string) {
    const normalizedPhone = normalizeWhatsAppPhone(phone)
    if (!normalizedPhone) {
        throw new Error("Enter a valid test phone number.")
    }

    await postWhatChimp(connection, "/whatsapp/get/conversation", {
        limit: "1",
        offset: "1",
        phone_number: normalizedPhone.replace(/^\+/, ""),
    })
}

export async function sendWhatChimpSessionMessage(
    connection: WhatsAppConnectionSecrets,
    phone: string,
    message: string
) {
    const normalizedPhone = normalizeWhatsAppPhone(phone)
    if (!normalizedPhone) {
        throw new Error("The customer phone number is invalid.")
    }

    if (!connection.isActive) throw new Error("The WhatsApp connection is paused.")
    await reserveWhatsAppRecipient(normalizedPhone)

    const payload = await postWhatChimp(connection, "/whatsapp/send", {
        message,
        phone_number: normalizedPhone.replace(/^\+/, ""),
    })

    return typeof payload.wa_message_id === "string" ? payload.wa_message_id : null
}

function requireMetaConnection(connection: WhatsAppConnectionSecrets) {
    if (!connection.metaAccessToken || !connection.wabaId) {
        throw new Error("Add the Meta access token and WABA ID in Connection Settings to submit templates.")
    }

    if (!/^v\d+\.\d+$/.test(connection.graphApiVersion)) {
        throw new Error("The Meta Graph API version is invalid.")
    }

    return {
        accessToken: connection.metaAccessToken,
        graphApiVersion: connection.graphApiVersion,
        wabaId: connection.wabaId,
    }
}

export async function sendMetaTemplateMessage(input: {
    language: string
    name: string
    phone: string
    values: string[]
}) {
    const connection = await loadWhatsAppConnection()
    const normalizedPhone = normalizeWhatsAppPhone(input.phone)

    if (!normalizedPhone) {
        throw new Error("The customer phone number is invalid.")
    }

    if (!connection.metaAccessToken) {
        throw new Error("Add the Meta access token in Connection Settings to send template messages.")
    }

    if (!connection.isActive) throw new Error("The WhatsApp connection is paused.")
    await reserveWhatsAppRecipient(normalizedPhone)

    const response = await fetch(
        `https://graph.facebook.com/${connection.graphApiVersion}/${encodeURIComponent(connection.phoneNumberId)}/messages`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${connection.metaAccessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: normalizedPhone.replace(/^\+/, ""),
                type: "template",
                template: {
                    name: input.name,
                    language: { code: input.language },
                    components: input.values.length > 0
                        ? [{
                            type: "body",
                            parameters: input.values.map((value) => ({ type: "text", text: value })),
                        }]
                        : undefined,
                },
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
        }
    )
    const payload = await parseProviderResponse(response)

    if (!response.ok) {
        const nestedError = typeof payload.error === "object" && payload.error !== null
            ? payload.error as { message?: unknown }
            : null
        throw new Error(
            typeof nestedError?.message === "string"
                ? nestedError.message
                : getProviderMessage(payload, "Meta could not send the template message.")
        )
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : []
    const firstMessage = typeof messages[0] === "object" && messages[0] !== null
        ? messages[0] as { id?: unknown }
        : null

    return typeof firstMessage?.id === "string" ? firstMessage.id : null
}

export async function submitMetaTemplate(input: {
    body: string
    category: "authentication" | "marketing" | "utility"
    language: string
    name: string
    variables: WhatsAppTemplateVariable[]
}) {
    const connection = await loadWhatsAppConnection()
    const meta = requireMetaConnection(connection)
    const variableIndex = new Map(input.variables.map((variable, index) => [variable.name, index + 1]))
    const metaBody = input.body.replace(
        /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
        (_, name: string) => `{{${variableIndex.get(name) ?? 1}}}`
    )
    const bodyComponent: Record<string, unknown> = {
        type: "BODY",
        text: metaBody,
    }

    if (input.variables.length > 0) {
        bodyComponent.example = {
            body_text: [input.variables.map((variable) => variable.example)],
        }
    }

    const response = await fetch(
        `https://graph.facebook.com/${meta.graphApiVersion}/${encodeURIComponent(meta.wabaId)}/message_templates`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${meta.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                category: input.category.toUpperCase(),
                components: [bodyComponent],
                language: input.language,
                name: input.name,
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
        }
    )
    const payload = await parseProviderResponse(response)

    if (!response.ok) {
        const nestedError = typeof payload.error === "object" && payload.error !== null
            ? payload.error as { message?: unknown }
            : null
        throw new Error(
            typeof nestedError?.message === "string"
                ? nestedError.message
                : getProviderMessage(payload, "Meta rejected the template submission.")
        )
    }

    return typeof payload.id === "string" ? payload.id : null
}

export async function listMetaTemplates() {
    const connection = await loadWhatsAppConnection()
    const meta = requireMetaConnection(connection)
    const templates: Array<{ id: string | null; name: string; language: string; category: string | null; rejectionReason: string | null; status: string }> = []
    let after: string | null = null
    for (let page = 0; page < 4; page++) {
        const url = new URL(`https://graph.facebook.com/${meta.graphApiVersion}/${encodeURIComponent(meta.wabaId)}/message_templates`)
        url.searchParams.set("fields", "id,name,language,category,status,rejected_reason")
        url.searchParams.set("limit", "250")
        if (after) url.searchParams.set("after", after)
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${meta.accessToken}` },
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
        })
        const payload = await parseProviderResponse(response)

        if (!response.ok) throw new Error("Unable to sync template status from Meta. Check the Meta token and business account.")
        if (!Array.isArray(payload.data)) throw new Error("Meta returned an unexpected template list.")

        for (const item of payload.data) {
            if (typeof item !== "object" || item === null) continue
            const row = item as { id?: unknown; name?: unknown; language?: unknown; category?: unknown; rejected_reason?: unknown; status?: unknown }
            if (typeof row.name !== "string" || typeof row.language !== "string" || typeof row.status !== "string") continue
            templates.push({
                id: typeof row.id === "string" ? row.id : null,
                name: row.name,
                language: row.language,
                category: typeof row.category === "string" ? row.category.toLowerCase() : null,
                rejectionReason: typeof row.rejected_reason === "string" ? row.rejected_reason : null,
                status: row.status.toLowerCase(),
            })
        }
        const paging = payload.paging as { cursors?: { after?: unknown }; next?: unknown } | undefined
        if (typeof paging?.next !== "string" || typeof paging.cursors?.after !== "string") return templates
        if (page === 3) throw new Error("Meta has more than 1,000 templates. Sync stopped to avoid an incomplete update.")
        after = paging.cursors.after
    }

    return templates
}
