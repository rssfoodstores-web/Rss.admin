import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import {
    normalizeSupportAISettings,
    normalizeSupportConversationSnapshot,
    type SupportAISettings,
    type SupportConversationSnapshot,
} from "@/lib/supportChat"
import type { Database } from "@/types/database.types"

type AppSupabaseClient = SupabaseClient<Database>

export async function getSupportAiSettings(supabase: AppSupabaseClient): Promise<SupportAISettings> {
    const { data, error } = await supabase.rpc("get_support_ai_settings")

    if (error) {
        throw new Error(error.message)
    }

    return normalizeSupportAISettings(data)
}

export async function fetchSupportConversationSnapshot(
    supabase: AppSupabaseClient,
    conversationId: string,
    accessToken: string | null
): Promise<SupportConversationSnapshot> {
    const { data, error } = await supabase.rpc("get_support_conversation_snapshot", {
        p_access_token: accessToken ?? undefined,
        p_conversation_id: conversationId,
    })

    if (error) {
        throw new Error(error.message)
    }

    const snapshot = normalizeSupportConversationSnapshot(data)
    if (!snapshot) {
        throw new Error("Support conversation could not be loaded.")
    }

    return snapshot
}

export async function buildSupportAssistantContext(
    supabase: AppSupabaseClient,
    user: User | null
) {
    if (!user) {
        return {
            customer: {
                email: "",
                isAuthenticated: false,
                name: "",
                phone: null,
            },
            giftCards: {
                activeCount: 0,
                totalRemainingKobo: 0,
            },
            recentOrders: [],
            rewards: null,
        }
    }

    const [{ data: profile }, { data: orders }, { data: rewardBalance }, { data: giftCards }] = await Promise.all([
        supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", user.id)
            .maybeSingle(),
        supabase
            .from("orders")
            .select("id, status, payment_status, created_at, total_amount")
            .eq("customer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        supabase
            .from("reward_point_balances")
            .select("available_points, pending_points")
            .eq("user_id", user.id)
            .maybeSingle(),
        supabase
            .from("gift_cards")
            .select("remaining_amount_kobo")
            .eq("recipient_id", user.id)
            .eq("status", "active")
            .gt("remaining_amount_kobo", 0),
    ])

    return {
        customer: {
            email: user.email?.trim() ?? "",
            isAuthenticated: true,
            name: profile?.full_name?.trim() ?? user.user_metadata?.full_name?.trim() ?? "",
            phone: profile?.phone?.trim() ?? user.phone?.trim() ?? null,
        },
        giftCards: {
            activeCount: giftCards?.length ?? 0,
            totalRemainingKobo: (giftCards ?? []).reduce((sum, card) => sum + (card.remaining_amount_kobo ?? 0), 0),
        },
        recentOrders: (orders ?? []).map((order) => ({
            createdAt: order.created_at,
            id: order.id,
            paymentStatus: String(order.payment_status),
            status: order.status ? String(order.status) : null,
            totalAmountKobo: order.total_amount,
        })),
        rewards: rewardBalance
            ? {
                availablePoints: rewardBalance.available_points ?? 0,
                pendingPoints: rewardBalance.pending_points ?? 0,
            }
            : null,
    }
}

export async function appendSupportHandoffMessage(
    supabase: AppSupabaseClient,
    {
        accessToken,
        conversationId,
        handoffMessage,
        metadata,
    }: {
        accessToken: string | null
        conversationId: string
        handoffMessage: string
        metadata?: Database["public"]["Tables"]["support_messages"]["Insert"]["metadata"]
    }
) {
    const { error } = await supabase.rpc("append_support_assistant_message", {
        p_access_token: accessToken ?? "",
        p_ai_generated: false,
        p_body: handoffMessage,
        p_conversation_id: conversationId,
        p_metadata: metadata ?? { type: "handoff" },
        p_resolved_by_ai: false,
        p_response_time_ms: undefined,
        p_sender_role: "system",
        p_should_escalate: true,
    })

    if (error) {
        throw new Error(error.message)
    }
}
