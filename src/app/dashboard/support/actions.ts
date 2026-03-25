"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    SUPPORT_AI_SETTINGS_KEY,
    SUPPORT_CHAT_STATUSES,
    normalizeSupportAISettings,
    toStoredSupportAISettings,
    type SupportAISettings,
    type SupportConversationSnapshot,
    type SupportConversationStatus,
} from "@/lib/supportChat"
import { fetchSupportConversationSnapshot, getSupportAiSettings } from "@/lib/supportChatServer"

export interface SupportAdminConversationListItem {
    aiEnabledSnapshot: boolean
    createdAt: string
    escalatedToHuman: boolean
    id: string
    lastMessageAt: string
    lastMessagePreview: string | null
    resolvedByAi: boolean
    status: SupportConversationStatus
    subject: string | null
    visitorEmail: string
    visitorName: string
    visitorPhone: string | null
}

interface SupportAdminStats {
    averageAiResponseTimeMs: number | null
    escalationRate: number
    humanFollowUpCount: number
    openCount: number
    resolvedByAiRate: number
    totalConversations: number
}

export interface SupportAdminPageData {
    conversations: SupportAdminConversationListItem[]
    selectedConversationId: string | null
    selectedSnapshot: SupportConversationSnapshot | null
    settings: SupportAISettings
    stats: SupportAdminStats
}

function validateStatus(status: string): SupportConversationStatus {
    if (!SUPPORT_CHAT_STATUSES.includes(status as SupportConversationStatus)) {
        throw new Error("Unsupported support status.")
    }

    return status as SupportConversationStatus
}

function roundPercent(value: number) {
    return Math.round(value * 10) / 10
}

async function requireAdmin() {
    return requireAdminRouteAccess("support")
}

export async function getSupportAdminPageData(selectedConversationId?: string | null): Promise<SupportAdminPageData> {
    const { supabase } = await requireAdmin()

    const [
        settings,
        conversationsResponse,
        totalConversationsResponse,
        resolvedByAiResponse,
        escalatedResponse,
        openResponse,
        humanFollowUpResponse,
        aiMessageResponse,
    ] = await Promise.all([
        getSupportAiSettings(supabase),
        supabase
            .from("support_conversations")
            .select("id, visitor_name, visitor_email, visitor_phone, subject, status, ai_enabled_snapshot, resolved_by_ai, escalated_to_human, last_message_at, last_message_preview, created_at")
            .order("last_message_at", { ascending: false })
            .limit(80),
        supabase
            .from("support_conversations")
            .select("id", { count: "exact", head: true }),
        supabase
            .from("support_conversations")
            .select("id", { count: "exact", head: true })
            .eq("resolved_by_ai", true),
        supabase
            .from("support_conversations")
            .select("id", { count: "exact", head: true })
            .eq("escalated_to_human", true),
        supabase
            .from("support_conversations")
            .select("id", { count: "exact", head: true })
            .eq("status", "open"),
        supabase
            .from("support_conversations")
            .select("id", { count: "exact", head: true })
            .eq("status", "human_follow_up"),
        supabase
            .from("support_messages")
            .select("response_time_ms")
            .eq("ai_generated", true)
            .not("response_time_ms", "is", null)
            .order("created_at", { ascending: false })
            .limit(500),
    ])

    if (conversationsResponse.error) {
        throw new Error(conversationsResponse.error.message)
    }

    const conversations = (conversationsResponse.data ?? []).map((conversation) => ({
        aiEnabledSnapshot: conversation.ai_enabled_snapshot,
        createdAt: conversation.created_at,
        escalatedToHuman: conversation.escalated_to_human,
        id: conversation.id,
        lastMessageAt: conversation.last_message_at,
        lastMessagePreview: conversation.last_message_preview,
        resolvedByAi: conversation.resolved_by_ai,
        status: validateStatus(conversation.status),
        subject: conversation.subject,
        visitorEmail: conversation.visitor_email,
        visitorName: conversation.visitor_name,
        visitorPhone: conversation.visitor_phone,
    }))

    const requestedConversationId = selectedConversationId?.trim() || null
    const effectiveSelectedConversationId = requestedConversationId && conversations.some((conversation) => conversation.id === requestedConversationId)
        ? requestedConversationId
        : conversations[0]?.id ?? null

    const selectedSnapshot = effectiveSelectedConversationId
        ? await fetchSupportConversationSnapshot(supabase, effectiveSelectedConversationId, null)
        : null

    const aiResponseTimes = (aiMessageResponse.data ?? [])
        .map((message) => message.response_time_ms)
        .filter((value): value is number => typeof value === "number")

    const totalConversations = totalConversationsResponse.count ?? 0
    const resolvedByAiCount = resolvedByAiResponse.count ?? 0
    const escalatedCount = escalatedResponse.count ?? 0

    return {
        conversations,
        selectedConversationId: effectiveSelectedConversationId,
        selectedSnapshot,
        settings,
        stats: {
            averageAiResponseTimeMs: aiResponseTimes.length
                ? Math.round(aiResponseTimes.reduce((sum, value) => sum + value, 0) / aiResponseTimes.length)
                : null,
            escalationRate: totalConversations > 0 ? roundPercent((escalatedCount / totalConversations) * 100) : 0,
            humanFollowUpCount: humanFollowUpResponse.count ?? 0,
            openCount: openResponse.count ?? 0,
            resolvedByAiRate: totalConversations > 0 ? roundPercent((resolvedByAiCount / totalConversations) * 100) : 0,
            totalConversations,
        },
    }
}

export async function loadSupportAdminPageData(selectedConversationId?: string | null) {
    return getSupportAdminPageData(selectedConversationId)
}

export async function updateSupportAiSettings(input: SupportAISettings) {
    const { supabase } = await requireAdmin()
    const currentSettings = normalizeSupportAISettings(input)

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            description: "AI support chat settings for the contact-page support widget.",
            key: SUPPORT_AI_SETTINGS_KEY,
            value: toStoredSupportAISettings(currentSettings),
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/contact")
    revalidatePath("/dashboard/support")
    revalidatePath("/dashboard/settings")

    return { success: true }
}

export async function updateSupportConversationStatus(conversationId: string, status: SupportConversationStatus) {
    const { supabase } = await requireAdmin()
    const nextStatus = validateStatus(status)

    const updatePayload: {
        escalated_to_human?: boolean
        resolved_by_ai: boolean
        status: SupportConversationStatus
    } = {
        resolved_by_ai: false,
        status: nextStatus,
    }

    if (nextStatus === "human_follow_up") {
        updatePayload.escalated_to_human = true
    }

    const { error } = await supabase
        .from("support_conversations")
        .update(updatePayload)
        .eq("id", conversationId)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/dashboard/support")
    return { success: true }
}

export async function sendSupportAdminReply({
    body,
    conversationId,
    markResolved,
}: {
    body: string
    conversationId: string
    markResolved?: boolean
}) {
    const { supabase, user } = await requireAdmin()
    const trimmedBody = body.trim()

    if (trimmedBody.length < 2) {
        throw new Error("Reply must be at least 2 characters.")
    }

    if (trimmedBody.length > 4000) {
        throw new Error("Replies must be 4000 characters or fewer.")
    }

    const { error: insertError } = await supabase
        .from("support_messages")
        .insert({
            ai_generated: false,
            body: trimmedBody,
            conversation_id: conversationId,
            escalation_marker: false,
            metadata: {
                type: "human_reply",
            },
            sender_id: user.id,
            sender_role: "admin",
        })

    if (insertError) {
        throw new Error(insertError.message)
    }

    const { error: updateError } = await supabase
        .from("support_conversations")
        .update({
            escalated_to_human: true,
            last_message_at: new Date().toISOString(),
            last_message_preview: trimmedBody.slice(0, 220),
            resolved_by_ai: false,
            status: markResolved ? "resolved" : "human_follow_up",
        })
        .eq("id", conversationId)

    if (updateError) {
        throw new Error(updateError.message)
    }

    revalidatePath("/dashboard/support")
    return { success: true }
}
