"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
    encryptCredential,
    extractTemplateVariables,
    listMetaTemplates,
    loadWhatsAppConnection,
    normalizeWhatsAppPhone,
    renderTemplate,
    sendMetaTemplateMessage,
    sendWhatChimpSessionMessage,
    submitMetaTemplate,
    testWhatChimpConnection,
    type WhatsAppAccess,
    type WhatsAppCapability,
    type WhatsAppTemplateVariable,
} from "@/lib/whatsapp-center"

interface ActionResult {
    error?: string
    success?: true
}

export interface WhatsAppConnectionSummary {
    accountLabel: string
    graphApiVersion: string
    hasApiToken: boolean
    hasMetaToken: boolean
    isActive: boolean
    lastTestMessage: string | null
    lastTestStatus: "connected" | "failed" | null
    lastTestedAt: string | null
    phoneNumberId: string
    wabaId: string
    webhookSecret: string
    webhookUrl: string
}

export interface WhatsAppContactRecord {
    customFields: Record<string, string>
    email: string | null
    fullName: string
    id: string
    isActive: boolean
    labels: string[]
    optedIn: boolean
    phone: string
    source: "import" | "manual" | "rss_profile"
}

export interface WhatsAppTemplateRecord {
    body: string
    category: "authentication" | "marketing" | "utility"
    displayName: string
    externalTemplateId: string | null
    id: string
    language: string
    name: string
    rejectionReason: string | null
    status: "approved" | "draft" | "paused" | "pending" | "rejected"
    submittedAt: string | null
    variables: WhatsAppTemplateVariable[]
}

export interface WhatsAppCampaignRecord {
    createdAt: string
    deliveredCount: number
    failedCount: number
    id: string
    name: string
    readCount: number
    recipientCount: number
    sentCount: number
    status: "cancelled" | "completed" | "draft" | "failed" | "scheduled" | "sending"
    templateName: string | null
}

export interface WhatsAppMessageRecord {
    body: string
    contactName: string | null
    contactId: string
    createdAt: string
    direction: "inbound" | "outbound"
    errorMessage: string | null
    id: string
    sentBy: string | null
    status: "delivered" | "failed" | "queued" | "read" | "received" | "sent"
}

export interface WhatsAppConversationAssignment {
    assignedTo: string | null
    assignedToName: string | null
    contactId: string
    status: "open" | "pending" | "resolved"
}

export interface WhatsAppTeamRecord {
    accessLevel: "manager" | "none" | "operator" | "owner"
    canManageContacts: boolean
    canManageTemplates: boolean
    canSendCampaigns: boolean
    fullName: string
    role: "admin" | "sub_admin" | "supa_admin"
    userId: string
}

export interface WhatsAppCenterPageData {
    access: WhatsAppAccess
    campaigns: WhatsAppCampaignRecord[]
    connection: WhatsAppConnectionSummary | null
    contacts: WhatsAppContactRecord[]
    conversationAssignments: WhatsAppConversationAssignment[]
    currentUserId: string
    messages: WhatsAppMessageRecord[]
    stats: {
        activeContacts: number
        approvedTemplates: number
        deliveredMessages: number
        failedMessages: number
    }
    team: WhatsAppTeamRecord[]
    templates: WhatsAppTemplateRecord[]
}

export interface CsvAudienceRow {
    address: string
    email: string
    fullName: string
    id: string
    optedIn: boolean
    orderId: string
    orderStatus: string
    phone: string
    registrationMethod: "admin" | "email" | "google" | "phone" | "unknown"
    roles: string[]
    source: "admin" | "dashboard" | "rss"
    state: string
}

export interface CsvCampaignRow {
    consent: boolean
    fields: Record<string, string>
    phone: string
}

interface GrantRow {
    access_level: "manager" | "operator"
    can_manage_contacts: boolean
    can_manage_templates: boolean
    can_send_campaigns: boolean
}

function toStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function toStringRecord(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
}

function toVariables(value: unknown): WhatsAppTemplateVariable[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap((item) => {
        if (typeof item !== "object" || item === null) {
            return []
        }

        const record = item as { example?: unknown; name?: unknown }
        return typeof record.name === "string" && typeof record.example === "string"
            ? [{ name: record.name, example: record.example }]
            : []
    })
}

async function getWhatsAppContext() {
    const access = await requireAdminRouteAccess("whatsapp_center")
    const adminSupabase = createAdminClient()

    if (access.primaryRole === "supa_admin") {
        return {
            access,
            adminSupabase,
            whatsappAccess: {
                accessLevel: "owner",
                canManageContacts: true,
                canManageSettings: true,
                canManageTemplates: true,
                canSendCampaigns: true,
                canSendMessages: true,
            } satisfies WhatsAppAccess,
        }
    }

    const { data: grant } = await adminSupabase
        .from("whatsapp_access_grants")
        .select("access_level, can_manage_contacts, can_manage_templates, can_send_campaigns")
        .eq("user_id", access.user.id)
        .maybeSingle()

    if (!grant) {
        throw new Error("WhatsApp Center access has not been granted.")
    }

    const row = grant as GrantRow
    return {
        access,
        adminSupabase,
        whatsappAccess: {
            accessLevel: row.access_level,
            canManageContacts: row.can_manage_contacts,
            canManageSettings: false,
            canManageTemplates: row.can_manage_templates,
            canSendCampaigns: row.can_send_campaigns,
            canSendMessages: true,
        } satisfies WhatsAppAccess,
    }
}

async function requireCapability(capability: WhatsAppCapability) {
    const context = await getWhatsAppContext()
    const allowed = {
        campaigns: context.whatsappAccess.canSendCampaigns,
        contacts: context.whatsappAccess.canManageContacts,
        messages: context.whatsappAccess.canSendMessages,
        settings: context.whatsappAccess.canManageSettings,
        templates: context.whatsappAccess.canManageTemplates,
    }[capability]

    if (!allowed) {
        throw new Error("Your Supa Admin has not granted permission for this action.")
    }

    return context
}

async function writeAudit(
    context: Awaited<ReturnType<typeof getWhatsAppContext>>,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown>
) {
    await context.adminSupabase.from("audit_logs").insert({
        action,
        actor_id: context.access.user.id,
        actor_role: context.access.primaryRole,
        entity_id: entityId,
        entity_type: entityType,
        metadata,
    })
}

function refreshWhatsAppCenter() {
    revalidatePath("/dashboard/whatsapp")
    revalidatePath("/dashboard")
}

export async function getWhatsAppCenterPageData(): Promise<WhatsAppCenterPageData> {
    const context = await getWhatsAppContext()
    const admin = context.adminSupabase
    const [connectionResult, contactsResult, templatesResult, campaignsResult, messagesResult, templateAuditResult, assignmentsResult] = await Promise.all([
        admin.from("whatsapp_connections").select("account_label, graph_api_version, api_token_ciphertext, meta_access_token_ciphertext, is_active, last_test_message, last_test_status, last_tested_at, phone_number_id, waba_id, webhook_secret").eq("id", "primary").maybeSingle(),
        admin.from("whatsapp_contacts").select("id, source, full_name, phone, email, labels, custom_fields, opted_in, is_active").order("updated_at", { ascending: false }).limit(250),
        admin.from("whatsapp_templates").select("id, name, display_name, category, language, body, variables, status, external_template_id, rejection_reason, created_at").order("updated_at", { ascending: false }).limit(100),
        admin.from("whatsapp_campaigns").select("id, name, status, recipient_count, sent_count, delivered_count, read_count, failed_count, created_at, whatsapp_templates(name)").order("created_at", { ascending: false }).limit(50),
        admin.from("whatsapp_messages").select("id, contact_id, body, direction, status, error_message, sent_by, created_at, whatsapp_contacts(full_name)").order("created_at", { ascending: false }).limit(1000),
        admin.from("audit_logs").select("entity_id, created_at").eq("action", "submit_whatsapp_template").order("created_at", { ascending: true }).limit(500),
        admin.from("whatsapp_conversation_assignments").select("contact_id, assigned_to, status"),
    ])

    const firstError = [connectionResult.error, contactsResult.error, templatesResult.error, campaignsResult.error, messagesResult.error, templateAuditResult.error, assignmentsResult.error].find(Boolean)
    if (firstError) {
        throw new Error(firstError.message)
    }

    const connectionRow = connectionResult.data
    const contacts = (contactsResult.data ?? []).map((row) => ({
        customFields: toStringRecord(row.custom_fields),
        email: row.email ?? null,
        fullName: row.full_name,
        id: row.id,
        isActive: row.is_active,
        labels: toStringArray(row.labels),
        optedIn: row.opted_in,
        phone: row.phone,
        source: row.source as WhatsAppContactRecord["source"],
    }))
    const submittedAtByTemplate = new Map((templateAuditResult.data ?? []).filter((row) => row.entity_id).map((row) => [row.entity_id as string, row.created_at]))
    const templates = (templatesResult.data ?? []).map((row) => ({
        body: row.body,
        category: row.category as WhatsAppTemplateRecord["category"],
        displayName: row.display_name,
        externalTemplateId: row.external_template_id ?? null,
        id: row.id,
        language: row.language,
        name: row.name,
        rejectionReason: row.rejection_reason ?? null,
        status: row.status as WhatsAppTemplateRecord["status"],
        submittedAt: submittedAtByTemplate.get(row.id) ?? (row.external_template_id ? row.created_at : null),
        variables: toVariables(row.variables),
    }))
    const campaigns = (campaignsResult.data ?? []).map((row) => {
        const relation = Array.isArray(row.whatsapp_templates) ? row.whatsapp_templates[0] : row.whatsapp_templates
        return {
            createdAt: row.created_at,
            deliveredCount: row.delivered_count,
            failedCount: row.failed_count,
            id: row.id,
            name: row.name,
            readCount: row.read_count,
            recipientCount: row.recipient_count,
            sentCount: row.sent_count,
            status: row.status as WhatsAppCampaignRecord["status"],
            templateName: relation?.name ?? null,
        }
    })
    const messages = (messagesResult.data ?? []).map((row) => {
        const relation = Array.isArray(row.whatsapp_contacts) ? row.whatsapp_contacts[0] : row.whatsapp_contacts
        return {
            body: row.body,
            contactId: row.contact_id,
            contactName: relation?.full_name ?? null,
            createdAt: row.created_at,
            direction: row.direction as WhatsAppMessageRecord["direction"],
            errorMessage: row.error_message ?? null,
            id: row.id,
            sentBy: row.sent_by ?? null,
            status: row.status as WhatsAppMessageRecord["status"],
        }
    })

    let team: WhatsAppTeamRecord[] = []
    {
        const [{ data: roleRows }, { data: profileRows }, { data: grantRows }] = await Promise.all([
            admin.from("user_roles").select("user_id, role").in("role", ["admin", "sub_admin", "supa_admin"]),
            admin.from("profiles").select("id, full_name"),
            admin.from("whatsapp_access_grants").select("user_id, access_level, can_manage_contacts, can_manage_templates, can_send_campaigns"),
        ])
        const profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile.full_name]))
        const grantMap = new Map((grantRows ?? []).map((grant) => [grant.user_id, grant as GrantRow & { user_id: string }]))

        team = (roleRows ?? []).map((roleRow) => {
            const grant = grantMap.get(roleRow.user_id)
            const isOwner = roleRow.role === "supa_admin"
            return {
                accessLevel: (isOwner ? "owner" : grant?.access_level ?? "none") as WhatsAppTeamRecord["accessLevel"],
                canManageContacts: isOwner || Boolean(grant?.can_manage_contacts),
                canManageTemplates: isOwner || Boolean(grant?.can_manage_templates),
                canSendCampaigns: isOwner || Boolean(grant?.can_send_campaigns),
                fullName: profileMap.get(roleRow.user_id) ?? "Unnamed administrator",
                role: roleRow.role as WhatsAppTeamRecord["role"],
                userId: roleRow.user_id,
            }
        }).sort((left, right) => left.fullName.localeCompare(right.fullName))
    }

    const teamNameById = new Map(team.map((member) => [member.userId, member.fullName]))
    const conversationAssignments = (assignmentsResult.data ?? []).map((row) => ({
        assignedTo: row.assigned_to ?? null,
        assignedToName: row.assigned_to ? teamNameById.get(row.assigned_to) ?? "Another administrator" : null,
        contactId: row.contact_id,
        status: row.status as WhatsAppConversationAssignment["status"],
    }))

    return {
        access: context.whatsappAccess,
        campaigns,
        connection: connectionRow ? {
            accountLabel: connectionRow.account_label,
            graphApiVersion: connectionRow.graph_api_version,
            hasApiToken: Boolean(connectionRow.api_token_ciphertext),
            hasMetaToken: Boolean(connectionRow.meta_access_token_ciphertext),
            isActive: connectionRow.is_active,
            lastTestMessage: connectionRow.last_test_message ?? null,
            lastTestStatus: connectionRow.last_test_status as WhatsAppConnectionSummary["lastTestStatus"],
            lastTestedAt: connectionRow.last_tested_at ?? null,
            phoneNumberId: connectionRow.phone_number_id,
            wabaId: connectionRow.waba_id ?? "",
            webhookSecret: connectionRow.webhook_secret,
            webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")}/api/webhooks/whatchimp?key=${connectionRow.webhook_secret}`,
        } : null,
        contacts,
        conversationAssignments,
        currentUserId: context.access.user.id,
        messages,
        stats: {
            activeContacts: contacts.filter((contact) => contact.isActive).length,
            approvedTemplates: templates.filter((template) => template.status === "approved").length,
            deliveredMessages: messages.filter((message) => message.status === "delivered" || message.status === "read").length,
            failedMessages: messages.filter((message) => message.status === "failed").length,
        },
        team,
        templates,
    }
}

export async function saveWhatsAppConnection(input: {
    accountLabel: string
    apiToken: string
    graphApiVersion: string
    isActive: boolean
    metaAccessToken: string
    phoneNumberId: string
    wabaId: string
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("settings")
        const { data: existing } = await context.adminSupabase
            .from("whatsapp_connections")
            .select("api_token_ciphertext, meta_access_token_ciphertext")
            .eq("id", "primary")
            .maybeSingle()
        const apiToken = input.apiToken.trim()
        const metaAccessToken = input.metaAccessToken.trim()
        const phoneNumberId = input.phoneNumberId.trim()
        const graphApiVersion = input.graphApiVersion.trim() || "v24.0"

        if (!apiToken && !existing?.api_token_ciphertext) {
            return { error: "Enter the WhatChimp API token." }
        }
        if (!phoneNumberId) {
            return { error: "Enter the WhatsApp phone number ID." }
        }
        if (!/^v\d+\.\d+$/.test(graphApiVersion)) {
            return { error: "Use a Graph API version such as v24.0." }
        }

        const { error } = await context.adminSupabase.from("whatsapp_connections").upsert({
            account_label: input.accountLabel.trim() || "RSS Foods WhatsApp",
            api_base_url: "https://app.whatchimp.com/api/v1",
            api_token_ciphertext: apiToken ? encryptCredential(apiToken) : existing?.api_token_ciphertext,
            created_by: context.access.user.id,
            graph_api_version: graphApiVersion,
            id: "primary",
            is_active: input.isActive,
            meta_access_token_ciphertext: metaAccessToken
                ? encryptCredential(metaAccessToken)
                : existing?.meta_access_token_ciphertext ?? null,
            phone_number_id: phoneNumberId,
            provider: "whatchimp",
            updated_at: new Date().toISOString(),
            updated_by: context.access.user.id,
            waba_id: input.wabaId.trim() || null,
        }, { onConflict: "id" })

        if (error) {
            return { error: error.message }
        }

        await writeAudit(context, "save_whatsapp_connection", "whatsapp_connection", "primary", {
            has_meta_connection: Boolean(metaAccessToken || existing?.meta_access_token_ciphertext),
            phone_number_id: phoneNumberId,
        })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to save the connection." }
    }
}

export async function testSavedWhatsAppConnection(testPhone: string): Promise<ActionResult> {
    try {
        const context = await requireCapability("settings")
        const connection = await loadWhatsAppConnection(context.adminSupabase)
        await testWhatChimpConnection(connection, testPhone)
        await context.adminSupabase.from("whatsapp_connections").update({
            last_test_message: "WhatChimp accepted the authenticated request.",
            last_test_status: "connected",
            last_tested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", "primary")
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Connection test failed."
        const admin = createAdminClient()
        await admin.from("whatsapp_connections").update({
            last_test_message: message,
            last_test_status: "failed",
            last_tested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", "primary")
        refreshWhatsAppCenter()
        return { error: message }
    }
}

export async function saveWhatsAppAccess(input: {
    accessLevel: "manager" | "none" | "operator"
    canManageContacts: boolean
    canManageTemplates: boolean
    canSendCampaigns: boolean
    userId: string
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("settings")
        const { data: roles } = await context.adminSupabase
            .from("user_roles")
            .select("role")
            .eq("user_id", input.userId)
            .in("role", ["admin", "sub_admin", "supa_admin"])

        if ((roles ?? []).some((row) => row.role === "supa_admin")) {
            return { error: "Supa Admin access is permanent and cannot be changed." }
        }
        if (!roles?.length) {
            return { error: "Only an admin or sub-admin can receive WhatsApp Center access." }
        }

        if (input.accessLevel === "none") {
            const { error } = await context.adminSupabase.from("whatsapp_access_grants").delete().eq("user_id", input.userId)
            if (error) return { error: error.message }
        } else {
            const manager = input.accessLevel === "manager"
            const { error } = await context.adminSupabase.from("whatsapp_access_grants").upsert({
                access_level: input.accessLevel,
                can_manage_contacts: manager || input.canManageContacts,
                can_manage_templates: manager || input.canManageTemplates,
                can_send_campaigns: manager || input.canSendCampaigns,
                granted_by: context.access.user.id,
                updated_at: new Date().toISOString(),
                user_id: input.userId,
            }, { onConflict: "user_id" })
            if (error) return { error: error.message }
        }

        await writeAudit(context, "update_whatsapp_access", "whatsapp_access", input.userId, {
            access_level: input.accessLevel,
            can_manage_contacts: input.canManageContacts,
            can_manage_templates: input.canManageTemplates,
            can_send_campaigns: input.canSendCampaigns,
        })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to update access." }
    }
}

export async function saveWhatsAppContact(input: {
    email: string
    fullName: string
    id?: string
    labels: string[]
    optedIn: boolean
    phone: string
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("contacts")
        const phone = normalizeWhatsAppPhone(input.phone)
        if (!phone) return { error: "Enter a valid phone number including the country code." }
        if (!input.fullName.trim()) return { error: "Enter the customer name." }

        const payload = {
            email: input.email.trim() || null,
            full_name: input.fullName.trim(),
            is_active: true,
            labels: Array.from(new Set(input.labels.map((label) => label.trim()).filter(Boolean))),
            opted_in: input.optedIn,
            phone,
            source: "manual",
            updated_at: new Date().toISOString(),
        }
        const result = input.id
            ? await context.adminSupabase.from("whatsapp_contacts").update(payload).eq("id", input.id)
            : await context.adminSupabase.from("whatsapp_contacts").insert({
                ...payload,
                created_by: context.access.user.id,
            })
        if (result.error) return { error: result.error.message }

        await writeAudit(context, "save_whatsapp_contact", "whatsapp_contact", input.id ?? null, {
            opted_in: input.optedIn,
            phone,
        })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to save the customer." }
    }
}

export async function syncRssCustomers(): Promise<ActionResult & { imported?: number }> {
    try {
        const context = await requireCapability("contacts")
        const { data: profiles, error: profileError } = await context.adminSupabase
            .from("profiles")
            .select("id, full_name, phone")
            .not("phone", "is", null)
            .limit(5000)
        if (profileError) return { error: profileError.message }

        const rows = (profiles ?? []).flatMap((profile) => {
            const phone = normalizeWhatsAppPhone(profile.phone ?? "")
            return phone ? [{
                full_name: profile.full_name,
                phone,
                profile_id: profile.id,
                source: "rss_profile",
                updated_at: new Date().toISOString(),
            }] : []
        })
        let imported = 0
        for (let index = 0; index < rows.length; index += 250) {
            const { error } = await context.adminSupabase
                .from("whatsapp_contacts")
                .upsert(rows.slice(index, index + 250), { onConflict: "phone" })
            if (error) return { error: error.message }
            imported += rows.slice(index, index + 250).length
        }

        await writeAudit(context, "sync_rss_whatsapp_contacts", "whatsapp_contact", null, { imported })
        refreshWhatsAppCenter()
        return { imported, success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to sync RSS customers." }
    }
}

export async function saveWhatsAppTemplate(input: {
    body: string
    category: "authentication" | "marketing" | "utility"
    displayName: string
    id?: string
    language: string
    name: string
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("templates")
        const name = input.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
        const body = input.body.trim()
        if (!name) return { error: "Enter a template name." }
        if (!body) return { error: "Write the template message." }

        const payload = {
            body,
            category: input.category,
            display_name: input.displayName.trim() || name.replace(/_/g, " "),
            language: input.language.trim() || "en_US",
            name,
            status: "draft",
            updated_at: new Date().toISOString(),
            updated_by: context.access.user.id,
            variables: extractTemplateVariables(body),
        }
        const result = input.id
            ? await context.adminSupabase.from("whatsapp_templates").update(payload).eq("id", input.id)
            : await context.adminSupabase.from("whatsapp_templates").insert({
                ...payload,
                created_by: context.access.user.id,
            })
        if (result.error) return { error: result.error.message }

        await writeAudit(context, "save_whatsapp_template", "whatsapp_template", input.id ?? null, {
            category: input.category,
            name,
        })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to save the template." }
    }
}

export async function submitWhatsAppTemplate(templateId: string): Promise<ActionResult> {
    try {
        const context = await requireCapability("templates")
        const { data: template, error } = await context.adminSupabase
            .from("whatsapp_templates")
            .select("id, name, category, language, body, variables")
            .eq("id", templateId)
            .single()
        if (error || !template) return { error: error?.message ?? "Template not found." }

        const externalId = await submitMetaTemplate({
            body: template.body,
            category: template.category,
            language: template.language,
            name: template.name,
            variables: toVariables(template.variables),
        })
        const { error: updateError } = await context.adminSupabase.from("whatsapp_templates").update({
            external_template_id: externalId,
            rejection_reason: null,
            status: "pending",
            updated_at: new Date().toISOString(),
            updated_by: context.access.user.id,
        }).eq("id", templateId)
        if (updateError) return { error: updateError.message }

        await writeAudit(context, "submit_whatsapp_template", "whatsapp_template", templateId, { external_id: externalId })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to submit the template." }
    }
}

export async function syncWhatsAppTemplateStatuses(): Promise<ActionResult> {
    try {
        const context = await requireCapability("templates")
        const remoteTemplates = await listMetaTemplates()
        for (const template of remoteTemplates) {
            const supportedStatus = ["approved", "pending", "rejected", "paused"].includes(template.status)
                ? template.status
                : "pending"
            await context.adminSupabase.from("whatsapp_templates").update({
                external_template_id: template.id,
                rejection_reason: template.rejectionReason,
                status: supportedStatus,
                updated_at: new Date().toISOString(),
                updated_by: context.access.user.id,
            }).eq("name", template.name)
        }
        await writeAudit(context, "sync_whatsapp_templates", "whatsapp_template", null, {
            remote_count: remoteTemplates.length,
        })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to sync template status." }
    }
}

export async function sendQuickWhatsAppMessage(input: {
    contactId: string
    message: string
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("messages")
        const message = input.message.trim()
        if (!message) return { error: "Write a message first." }
        const { data: contact, error } = await context.adminSupabase
            .from("whatsapp_contacts")
            .select("id, phone")
            .eq("id", input.contactId)
            .single()
        if (error || !contact) return { error: error?.message ?? "Customer not found." }

        const connection = await loadWhatsAppConnection(context.adminSupabase)
        const externalMessageId = await sendWhatChimpSessionMessage(connection, contact.phone, message)
        const { error: logError } = await context.adminSupabase.from("whatsapp_messages").insert({
            body: message,
            contact_id: contact.id,
            direction: "outbound",
            external_message_id: externalMessageId,
            message_type: "session",
            sent_by: context.access.user.id,
            status: "sent",
        })
        if (logError) return { error: `Message sent, but the RSS log failed: ${logError.message}` }

        await writeAudit(context, "send_whatsapp_message", "whatsapp_contact", contact.id, { external_message_id: externalMessageId })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to send the message." }
    }
}

export async function sendSingleWhatsAppTemplate(input: {
    contactId: string
    templateId: string
    values: Record<string, string>
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("messages")
        const [{ data: contact, error: contactError }, { data: template, error: templateError }] = await Promise.all([
            context.adminSupabase.from("whatsapp_contacts").select("id, phone, full_name").eq("id", input.contactId).single(),
            context.adminSupabase.from("whatsapp_templates").select("id, name, language, body, variables, status").eq("id", input.templateId).single(),
        ])
        if (contactError || !contact) return { error: contactError?.message ?? "Customer not found." }
        if (templateError || !template) return { error: templateError?.message ?? "Template not found." }
        if (template.status !== "approved") return { error: "Choose a Meta-approved template." }

        const variables = toVariables(template.variables)
        const values = variables.map((variable) => input.values[variable.name]?.trim() ?? "")
        const missing = variables.find((variable, index) => !values[index])
        if (missing) return { error: `Enter ${missing.name.replace(/_/g, " ")} before sending.` }

        const externalMessageId = await sendMetaTemplateMessage({ language: template.language, name: template.name, phone: contact.phone, values })
        const body = renderTemplate(template.body, Object.fromEntries(variables.map((variable, index) => [variable.name, values[index]])))
        const { error: logError } = await context.adminSupabase.from("whatsapp_messages").insert({
            body,
            contact_id: contact.id,
            direction: "outbound",
            external_message_id: externalMessageId,
            message_type: "template",
            metadata: { template_id: template.id, template_name: template.name },
            sent_by: context.access.user.id,
            status: "sent",
        })
        if (logError) return { error: `Template sent, but the RSS log failed: ${logError.message}` }
        await writeAudit(context, "send_whatsapp_chat_template", "whatsapp_contact", contact.id, { template_id: template.id })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to send the template." }
    }
}

export async function assignWhatsAppConversation(input: {
    assigneeId: string | null
    contactId: string
    status?: "open" | "pending" | "resolved"
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("messages")
        const { error } = await context.adminSupabase.from("whatsapp_conversation_assignments").upsert({
            assigned_at: input.assigneeId ? new Date().toISOString() : null,
            assigned_to: input.assigneeId,
            contact_id: input.contactId,
            status: input.status ?? "open",
            updated_at: new Date().toISOString(),
        })
        if (error) return { error: error.message }
        await writeAudit(context, "assign_whatsapp_conversation", "whatsapp_contact", input.contactId, { assigned_to: input.assigneeId, status: input.status ?? "open" })
        refreshWhatsAppCenter()
        return { success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to update this conversation." }
    }
}

function resolveVariableValue(variable: string, contact: WhatsAppContactRecord, defaults: Record<string, string>) {
    const standardValues: Record<string, string> = {
        customer_name: contact.fullName,
        email: contact.email ?? "",
        full_name: contact.fullName,
        name: contact.fullName,
        phone: contact.phone,
    }
    return defaults[variable] ?? standardValues[variable] ?? contact.customFields[variable] ?? "-"
}

export async function loadCsvBuilderAudience(): Promise<{ error?: string; rows?: CsvAudienceRow[] }> {
    try {
        const context = await requireCapability("campaigns")
        const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: orders, error: ordersError }, { data: contacts, error: contactsError }] = await Promise.all([
            context.adminSupabase.from("profiles").select("id, full_name, phone, address, state, street_address, house_number").limit(5000),
            context.adminSupabase.from("user_roles").select("user_id, role").limit(10000),
            context.adminSupabase.from("orders").select("id, customer_id, status, created_at").order("created_at", { ascending: false }).limit(10000),
            context.adminSupabase.from("whatsapp_contacts").select("id, profile_id, full_name, phone, email, opted_in, is_active, source, custom_fields").limit(5000),
        ])
        const firstError = profilesError ?? rolesError ?? ordersError ?? contactsError
        if (firstError) return { error: firstError.message }

        const authById = new Map<string, { email: string; registrationMethod: CsvAudienceRow["registrationMethod"] }>()
        for (let page = 1; page <= 10; page += 1) {
            const { data, error } = await context.adminSupabase.auth.admin.listUsers({ page, perPage: 1000 })
            if (error) return { error: error.message }
            for (const user of data.users) {
                const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : ""
                const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []
                const creationMethod = typeof user.app_metadata?.creation_method === "string" ? user.app_metadata.creation_method : ""
                authById.set(user.id, {
                    email: user.email ?? "",
                    registrationMethod: creationMethod === "admin_password_account"
                        ? "admin"
                        : provider === "google" || providers.includes("google") || user.identities?.some((identity) => identity.provider === "google")
                            ? "google"
                            : user.phone_confirmed_at
                                ? "phone"
                                : user.email_confirmed_at
                                    ? "email"
                                    : "unknown",
                })
            }
            if (data.users.length < 1000) break
        }

        const rolesByUser = new Map<string, string[]>()
        for (const row of roles ?? []) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), String(row.role)])
        const latestOrderByUser = new Map<string, { id: string; status: string }>()
        for (const order of orders ?? []) if (!latestOrderByUser.has(order.customer_id)) latestOrderByUser.set(order.customer_id, { id: order.id, status: String(order.status ?? "") })
        const contactByProfile = new Map((contacts ?? []).filter((row) => row.profile_id).map((row) => [row.profile_id as string, row]))

        const rssRows: CsvAudienceRow[] = (profiles ?? []).map((profile) => {
            const contact = contactByProfile.get(profile.id)
            const auth = authById.get(profile.id)
            const order = latestOrderByUser.get(profile.id)
            return {
                address: [profile.house_number, profile.street_address, profile.address].filter(Boolean).join(" "),
                email: contact?.email ?? auth?.email ?? "",
                fullName: profile.full_name,
                id: `rss:${profile.id}`,
                optedIn: Boolean(contact?.opted_in && contact?.is_active),
                orderId: order?.id ?? "",
                orderStatus: order?.status ?? "",
                phone: normalizeWhatsAppPhone(contact?.phone ?? profile.phone ?? "") ?? "",
                registrationMethod: auth?.registrationMethod ?? "unknown",
                roles: rolesByUser.get(profile.id) ?? [],
                source: auth?.registrationMethod === "admin" ? "admin" : "rss",
                state: profile.state ?? "",
            }
        })
        const manualRows: CsvAudienceRow[] = (contacts ?? []).filter((contact) => !contact.profile_id).map((contact) => ({
            address: toStringRecord(contact.custom_fields).address ?? "",
            email: contact.email ?? "",
            fullName: contact.full_name,
            id: `dashboard:${contact.id}`,
            optedIn: Boolean(contact.opted_in && contact.is_active),
            orderId: toStringRecord(contact.custom_fields).order_number ?? "",
            orderStatus: toStringRecord(contact.custom_fields).order_status ?? "",
            phone: normalizeWhatsAppPhone(contact.phone) ?? "",
            registrationMethod: "unknown",
            roles: ["customer"],
            source: "dashboard",
            state: toStringRecord(contact.custom_fields).state ?? "",
        }))
        return { rows: [...rssRows, ...manualRows] }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to load audience data." }
    }
}

export async function sendCsvCampaign(input: {
    name: string
    rows: CsvCampaignRow[]
    templateId: string
    variableColumns: Record<string, string>
}): Promise<ActionResult & { failed?: number; sent?: number }> {
    try {
        const context = await requireCapability("campaigns")
        const rows = input.rows.slice(0, 5000)
        if (!input.name.trim()) return { error: "Name this campaign." }
        if (rows.length === 0) return { error: "Choose a CSV with at least one recipient." }
        const { data: template, error: templateError } = await context.adminSupabase.from("whatsapp_templates").select("id, name, language, body, variables, status").eq("id", input.templateId).single()
        if (templateError || !template) return { error: templateError?.message ?? "Template not found." }
        if (template.status !== "approved") return { error: "Only an approved template can be sent." }
        const variables = toVariables(template.variables)
        for (const variable of variables) if (!input.variableColumns[variable.name]) return { error: `Choose a column for ${variable.name.replace(/_/g, " ")}.` }

        const prepared = rows.flatMap((row) => {
            const phone = normalizeWhatsAppPhone(row.phone)
            if (!phone || !row.consent) return []
            const values = variables.map((variable) => row.fields[input.variableColumns[variable.name]]?.trim() ?? "")
            return values.some((value) => !value) ? [] : [{ phone, values, fields: row.fields }]
        })
        if (prepared.length === 0) return { error: "No rows are ready. Check phone numbers, consent and required values." }

        const { data: campaign, error: campaignError } = await context.adminSupabase.from("whatsapp_campaigns").insert({
            approved_by: context.access.user.id,
            created_by: context.access.user.id,
            name: input.name.trim(),
            recipient_count: prepared.length,
            status: "sending",
            template_id: template.id,
            variable_defaults: input.variableColumns,
        }).select("id").single()
        if (campaignError || !campaign) return { error: campaignError?.message ?? "Unable to create the campaign." }

        let sent = 0
        let failed = 0
        for (let index = 0; index < prepared.length; index += 5) {
            const outcomes = await Promise.all(prepared.slice(index, index + 5).map(async (row) => {
                const body = renderTemplate(template.body, Object.fromEntries(variables.map((variable, i) => [variable.name, row.values[i]])))
                try {
                    const externalMessageId = await sendMetaTemplateMessage({ language: template.language, name: template.name, phone: row.phone, values: row.values })
                    sent += 1
                    return { body, campaign_id: campaign.id, contact_id: null, direction: "outbound", external_message_id: externalMessageId, message_type: "template", metadata: { phone: row.phone }, sent_by: context.access.user.id, status: "sent" }
                } catch (error) {
                    failed += 1
                    return { body, campaign_id: campaign.id, contact_id: null, direction: "outbound", error_message: error instanceof Error ? error.message : "Send failed", message_type: "template", metadata: { phone: row.phone }, sent_by: context.access.user.id, status: "failed" }
                }
            }))
            await context.adminSupabase.from("whatsapp_messages").insert(outcomes)
        }
        await context.adminSupabase.from("whatsapp_campaigns").update({ failed_count: failed, sent_count: sent, status: failed === prepared.length ? "failed" : "completed", updated_at: new Date().toISOString() }).eq("id", campaign.id)
        await writeAudit(context, "send_csv_whatsapp_campaign", "whatsapp_campaign", campaign.id, { failed, recipients: prepared.length, sent })
        refreshWhatsAppCenter()
        return { failed, sent, success: true }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to send the CSV campaign." }
    }
}

export async function sendWhatsAppCampaign(input: {
    contactIds: string[]
    name: string
    templateId: string
    variableDefaults: Record<string, string>
}): Promise<ActionResult> {
    try {
        const context = await requireCapability("campaigns")
        const contactIds = Array.from(new Set(input.contactIds)).slice(0, 50)
        if (!input.name.trim()) return { error: "Name this campaign." }
        if (contactIds.length === 0) return { error: "Select at least one opted-in customer." }

        const [{ data: template, error: templateError }, { data: contactRows, error: contactError }] = await Promise.all([
            context.adminSupabase.from("whatsapp_templates").select("id, name, language, body, variables, status").eq("id", input.templateId).single(),
            context.adminSupabase.from("whatsapp_contacts").select("id, full_name, phone, email, labels, custom_fields, opted_in, is_active, source").in("id", contactIds).eq("opted_in", true).eq("is_active", true),
        ])
        if (templateError || !template) return { error: templateError?.message ?? "Template not found." }
        if (template.status !== "approved") return { error: "Only an approved template can be broadcast." }
        if (contactError) return { error: contactError.message }

        const contacts: WhatsAppContactRecord[] = (contactRows ?? []).map((row) => ({
            customFields: toStringRecord(row.custom_fields),
            email: row.email ?? null,
            fullName: row.full_name,
            id: row.id,
            isActive: row.is_active,
            labels: toStringArray(row.labels),
            optedIn: row.opted_in,
            phone: row.phone,
            source: row.source as WhatsAppContactRecord["source"],
        }))
        if (contacts.length === 0) return { error: "None of the selected customers have active WhatsApp consent." }

        const { data: campaign, error: campaignError } = await context.adminSupabase.from("whatsapp_campaigns").insert({
            approved_by: context.access.user.id,
            created_by: context.access.user.id,
            name: input.name.trim(),
            recipient_count: contacts.length,
            status: "sending",
            template_id: template.id,
            variable_defaults: input.variableDefaults,
        }).select("id").single()
        if (campaignError || !campaign) return { error: campaignError?.message ?? "Unable to create the campaign." }

        const variables = toVariables(template.variables)
        let sentCount = 0
        let failedCount = 0
        for (let index = 0; index < contacts.length; index += 5) {
            const batch = contacts.slice(index, index + 5)
            const outcomes = await Promise.all(batch.map(async (contact) => {
                const values = variables.map((variable) => resolveVariableValue(variable.name, contact, input.variableDefaults))
                const renderedBody = renderTemplate(template.body, Object.fromEntries(variables.map((variable, variableIndex) => [variable.name, values[variableIndex]])))
                try {
                    const externalMessageId = await sendMetaTemplateMessage({
                        language: template.language,
                        name: template.name,
                        phone: contact.phone,
                        values,
                    })
                    return {
                        body: renderedBody,
                        campaign_id: campaign.id,
                        contact_id: contact.id,
                        direction: "outbound",
                        external_message_id: externalMessageId,
                        message_type: "template",
                        sent_by: context.access.user.id,
                        status: "sent",
                    }
                } catch (sendError) {
                    return {
                        body: renderedBody,
                        campaign_id: campaign.id,
                        contact_id: contact.id,
                        direction: "outbound",
                        error_message: sendError instanceof Error ? sendError.message : "Send failed.",
                        message_type: "template",
                        sent_by: context.access.user.id,
                        status: "failed",
                    }
                }
            }))
            sentCount += outcomes.filter((outcome) => outcome.status === "sent").length
            failedCount += outcomes.filter((outcome) => outcome.status === "failed").length
            await context.adminSupabase.from("whatsapp_messages").insert(outcomes)
        }

        await context.adminSupabase.from("whatsapp_campaigns").update({
            failed_count: failedCount,
            sent_count: sentCount,
            status: sentCount > 0 ? "completed" : "failed",
            updated_at: new Date().toISOString(),
        }).eq("id", campaign.id)
        await writeAudit(context, "send_whatsapp_campaign", "whatsapp_campaign", campaign.id, {
            failed_count: failedCount,
            recipient_count: contacts.length,
            sent_count: sentCount,
        })
        refreshWhatsAppCenter()
        return sentCount > 0 ? { success: true } : { error: "The campaign was created, but every message failed." }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to send the campaign." }
    }
}
