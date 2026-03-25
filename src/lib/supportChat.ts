import type { Json } from "@/types/database.types"

export const SUPPORT_CHAT_STORAGE_KEY = "rss-support-chat"
export const SUPPORT_AI_SETTINGS_KEY = "support_ai_settings"

export const SUPPORT_CHAT_CHANNELS = ["contact_page"] as const
export const SUPPORT_CHAT_STATUSES = ["open", "human_follow_up", "resolved"] as const
export const SUPPORT_CHAT_SENDER_ROLES = ["customer", "assistant", "admin", "system"] as const

export type SupportChatChannel = (typeof SUPPORT_CHAT_CHANNELS)[number]
export type SupportConversationStatus = (typeof SUPPORT_CHAT_STATUSES)[number]
export type SupportMessageSenderRole = (typeof SUPPORT_CHAT_SENDER_ROLES)[number]

export interface SupportSuggestedLink {
    label: string
    url: string
}

export interface SupportAISettings {
    assistantName: string
    enabled: boolean
    handoffMessage: string
    model: string
    systemPrompt: string
    welcomeMessage: string
    welcomeTitle: string
}

export interface SupportConversationRecord {
    aiEnabledSnapshot: boolean
    channel: SupportChatChannel
    createdAt: string
    escalatedToHuman: boolean
    id: string
    lastAiMessageAt: string | null
    lastCustomerMessageAt: string | null
    lastMessageAt: string
    lastMessagePreview: string | null
    resolvedByAi: boolean
    status: SupportConversationStatus
    subject: string | null
    updatedAt: string
    userId: string | null
    visitorEmail: string
    visitorName: string
    visitorPhone: string | null
}

export interface SupportMessageRecord {
    aiGenerated: boolean
    body: string
    conversationId: string
    createdAt: string
    escalationMarker: boolean
    id: string
    metadata: Json
    responseTimeMs: number | null
    senderRole: SupportMessageSenderRole
}

export interface SupportConversationSnapshot {
    conversation: SupportConversationRecord
    messages: SupportMessageRecord[]
}

export interface SupportChatCurrentUser {
    email: string
    id: string | null
    isAuthenticated: boolean
    name: string
    phone: string
}

export interface SupportChatBootstrap {
    currentUser: SupportChatCurrentUser
    initialSnapshot: SupportConversationSnapshot | null
    settings: SupportAISettings
}

export interface StoredSupportConversationRef {
    accessToken: string | null
    conversationId: string
}

export const DEFAULT_SUPPORT_AI_SETTINGS: SupportAISettings = {
    assistantName: "RSS Support",
    enabled: true,
    handoffMessage: "We could not fully resolve this in chat. Our human support team will review the conversation and follow up using your email or phone number.",
    model: "gemini-2.5-flash",
    systemPrompt: "You are the RSS Foods website support assistant. Keep answers concise, practical, and accurate.",
    welcomeMessage: "Ask about orders, delivery timelines, payment instructions, gift cards, reward points, or checkout help.",
    welcomeTitle: "Chat with RSS Support",
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeRequiredText(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeOptionalText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback
}

function normalizeSenderRole(value: unknown): SupportMessageSenderRole {
    return typeof value === "string" && SUPPORT_CHAT_SENDER_ROLES.includes(value as SupportMessageSenderRole)
        ? value as SupportMessageSenderRole
        : "system"
}

function normalizeStatus(value: unknown): SupportConversationStatus {
    return typeof value === "string" && SUPPORT_CHAT_STATUSES.includes(value as SupportConversationStatus)
        ? value as SupportConversationStatus
        : "open"
}

function normalizeChannel(value: unknown): SupportChatChannel {
    return typeof value === "string" && SUPPORT_CHAT_CHANNELS.includes(value as SupportChatChannel)
        ? value as SupportChatChannel
        : "contact_page"
}

export function normalizeSupportAISettings(value: unknown): SupportAISettings {
    const row = isRecord(value) ? value : {}

    return {
        assistantName: normalizeRequiredText(row.assistant_name ?? row.assistantName, DEFAULT_SUPPORT_AI_SETTINGS.assistantName),
        enabled: normalizeBoolean(row.enabled, DEFAULT_SUPPORT_AI_SETTINGS.enabled),
        handoffMessage: normalizeRequiredText(row.handoff_message ?? row.handoffMessage, DEFAULT_SUPPORT_AI_SETTINGS.handoffMessage),
        model: normalizeRequiredText(row.model, DEFAULT_SUPPORT_AI_SETTINGS.model),
        systemPrompt: normalizeRequiredText(row.system_prompt ?? row.systemPrompt, DEFAULT_SUPPORT_AI_SETTINGS.systemPrompt),
        welcomeMessage: normalizeRequiredText(row.welcome_message ?? row.welcomeMessage, DEFAULT_SUPPORT_AI_SETTINGS.welcomeMessage),
        welcomeTitle: normalizeRequiredText(row.welcome_title ?? row.welcomeTitle, DEFAULT_SUPPORT_AI_SETTINGS.welcomeTitle),
    }
}

export function toStoredSupportAISettings(settings: SupportAISettings) {
    return {
        assistant_name: normalizeRequiredText(settings.assistantName, DEFAULT_SUPPORT_AI_SETTINGS.assistantName),
        enabled: Boolean(settings.enabled),
        handoff_message: normalizeRequiredText(settings.handoffMessage, DEFAULT_SUPPORT_AI_SETTINGS.handoffMessage),
        model: normalizeRequiredText(settings.model, DEFAULT_SUPPORT_AI_SETTINGS.model),
        system_prompt: normalizeRequiredText(settings.systemPrompt, DEFAULT_SUPPORT_AI_SETTINGS.systemPrompt),
        welcome_message: normalizeRequiredText(settings.welcomeMessage, DEFAULT_SUPPORT_AI_SETTINGS.welcomeMessage),
        welcome_title: normalizeRequiredText(settings.welcomeTitle, DEFAULT_SUPPORT_AI_SETTINGS.welcomeTitle),
    }
}

export function normalizeSupportMessage(value: unknown): SupportMessageRecord | null {
    const row = isRecord(value) ? value : null
    if (!row) {
        return null
    }

    return {
        aiGenerated: normalizeBoolean(row.aiGenerated ?? row.ai_generated, false),
        body: normalizeRequiredText(row.body, ""),
        conversationId: normalizeRequiredText(row.conversationId ?? row.conversation_id, ""),
        createdAt: normalizeRequiredText(row.createdAt ?? row.created_at, new Date(0).toISOString()),
        escalationMarker: normalizeBoolean(row.escalationMarker ?? row.escalation_marker, false),
        id: normalizeRequiredText(row.id, ""),
        metadata: (row.metadata as Json | undefined) ?? {},
        responseTimeMs: typeof row.responseTimeMs === "number"
            ? row.responseTimeMs
            : typeof row.response_time_ms === "number"
                ? row.response_time_ms
                : null,
        senderRole: normalizeSenderRole(row.senderRole ?? row.sender_role),
    }
}

export function normalizeSupportConversation(value: unknown): SupportConversationRecord | null {
    const row = isRecord(value) ? value : null
    if (!row) {
        return null
    }

    return {
        aiEnabledSnapshot: normalizeBoolean(row.aiEnabledSnapshot ?? row.ai_enabled_snapshot, true),
        channel: normalizeChannel(row.channel),
        createdAt: normalizeRequiredText(row.createdAt ?? row.created_at, new Date(0).toISOString()),
        escalatedToHuman: normalizeBoolean(row.escalatedToHuman ?? row.escalated_to_human, false),
        id: normalizeRequiredText(row.id, ""),
        lastAiMessageAt: normalizeOptionalText(row.lastAiMessageAt ?? row.last_ai_message_at),
        lastCustomerMessageAt: normalizeOptionalText(row.lastCustomerMessageAt ?? row.last_customer_message_at),
        lastMessageAt: normalizeRequiredText(row.lastMessageAt ?? row.last_message_at, new Date(0).toISOString()),
        lastMessagePreview: normalizeOptionalText(row.lastMessagePreview ?? row.last_message_preview),
        resolvedByAi: normalizeBoolean(row.resolvedByAi ?? row.resolved_by_ai, false),
        status: normalizeStatus(row.status),
        subject: normalizeOptionalText(row.subject),
        updatedAt: normalizeRequiredText(row.updatedAt ?? row.updated_at, new Date(0).toISOString()),
        userId: normalizeOptionalText(row.userId ?? row.user_id),
        visitorEmail: normalizeRequiredText(row.visitorEmail ?? row.visitor_email, ""),
        visitorName: normalizeRequiredText(row.visitorName ?? row.visitor_name, "Guest"),
        visitorPhone: normalizeOptionalText(row.visitorPhone ?? row.visitor_phone),
    }
}

export function normalizeSupportConversationSnapshot(value: unknown): SupportConversationSnapshot | null {
    const row = isRecord(value) ? value : null
    if (!row) {
        return null
    }

    const conversation = normalizeSupportConversation(row.conversation)
    if (!conversation) {
        return null
    }

    const messages = Array.isArray(row.messages)
        ? row.messages
            .map((message) => normalizeSupportMessage(message))
            .filter((message): message is SupportMessageRecord => Boolean(message))
        : []

    return {
        conversation,
        messages,
    }
}

export function normalizeStoredSupportConversationRef(value: unknown): StoredSupportConversationRef | null {
    const row = isRecord(value) ? value : null
    if (!row) {
        return null
    }

    const conversationId = normalizeRequiredText(row.conversationId, "")
    if (!conversationId) {
        return null
    }

    return {
        accessToken: normalizeOptionalText(row.accessToken),
        conversationId,
    }
}

export function getSupportStatusLabel(status: SupportConversationStatus) {
    switch (status) {
        case "human_follow_up":
            return "Human follow-up"
        case "resolved":
            return "Resolved"
        case "open":
        default:
            return "Open"
    }
}

export function getSupportStatusTone(status: SupportConversationStatus) {
    switch (status) {
        case "human_follow_up":
            return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300"
        case "resolved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
        case "open":
        default:
            return "border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300"
    }
}

export function getSupportSenderLabel(senderRole: SupportMessageSenderRole) {
    switch (senderRole) {
        case "assistant":
            return "AI support"
        case "admin":
            return "Support team"
        case "system":
            return "System"
        case "customer":
        default:
            return "You"
    }
}

export function extractSupportSuggestedLinks(metadata: Json): SupportSuggestedLink[] {
    if (!isRecord(metadata) || !Array.isArray(metadata.suggestedLinks)) {
        return []
    }

    return metadata.suggestedLinks
        .map((item) => {
            const row = isRecord(item) ? item : null
            if (!row) {
                return null
            }

            const label = normalizeRequiredText(row.label, "")
            const url = normalizeRequiredText(row.url, "")

            if (!label || !url.startsWith("/") || url.startsWith("//")) {
                return null
            }

            return { label, url }
        })
        .filter((item): item is SupportSuggestedLink => Boolean(item))
}
