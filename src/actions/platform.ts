"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { nairaToKobo } from "@/lib/money"
import { type AdminRouteKey, getPrimaryAdminRole } from "@/lib/admin-routes"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { WALLET_WITHDRAWAL_SETTINGS_KEY } from "@/lib/wallet-withdrawal-settings"

async function getActorContext(permissionKey: AdminRouteKey) {
    const access = await requireAdminRouteAccess(permissionKey)
    const actorRole = getPrimaryAdminRole(access.roleNames) ?? "admin"

    return {
        actorRole,
        supabase: access.supabase,
        user: access.user,
    }
}

async function writeAuditLog(
    supabase: Awaited<ReturnType<typeof createClient>>,
    {
        actorId,
        actorRole,
        action,
        entityType,
        entityId,
        metadata = {},
    }: {
        actorId: string
        actorRole: string
        action: string
        entityType: string
        entityId: string
        metadata?: Record<string, unknown>
    }
) {
    await supabase.from("audit_logs").insert({
        actor_id: actorId,
        actor_role: actorRole,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
    })
}

async function upsertSetting(
    supabase: Awaited<ReturnType<typeof createClient>>,
    key: string,
    value: Record<string, unknown>,
    description: string
) {
    return supabase
        .from("app_settings")
        .upsert(
            {
                key,
                value,
                description,
            },
            { onConflict: "key" }
        )
}

async function createNotification(
    supabase: Awaited<ReturnType<typeof createClient>>,
    {
        userId,
        title,
        message,
        type,
        actionUrl,
        metadata = {},
    }: {
        userId: string
        title: string
        message: string
        type: string
        actionUrl?: string
        metadata?: Record<string, unknown>
    }
) {
    await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        action_url: actionUrl ?? null,
        metadata,
    })
}

export async function updateDeliverySettings(formData: FormData) {
    const actor = await getActorContext("delivery_settings")
    const supabase = actor.supabase

    const baseFareNaira = Number(formData.get("base_fare_naira") ?? 0)
    const distanceRateNairaPerKm = Number(formData.get("distance_rate_naira_per_km") ?? 0)
    const riderSharePercent = Number(formData.get("rider_share_percent") ?? 0)
    const corporateDeliverySharePercent = Number(formData.get("corporate_delivery_share_percent") ?? 0)
    const originLat = Number(formData.get("origin_lat") ?? 0)
    const originLng = Number(formData.get("origin_lng") ?? 0)
    const originState = String(formData.get("origin_state") ?? "Lagos").trim()

    if (
        !Number.isFinite(baseFareNaira)
        || !Number.isFinite(distanceRateNairaPerKm)
        || !Number.isFinite(riderSharePercent)
        || !Number.isFinite(corporateDeliverySharePercent)
        || !Number.isFinite(originLat)
        || !Number.isFinite(originLng)
    ) {
        return { error: "Delivery settings must contain valid numbers." }
    }

    if (baseFareNaira < 0 || distanceRateNairaPerKm < 0) {
        return { error: "Base fare and distance rate cannot be negative." }
    }

    if (originLat < -90 || originLat > 90 || originLng < -180 || originLng > 180) {
        return { error: "Origin latitude or longitude is outside valid geographic bounds." }
    }

    if (!originState) {
        return { error: "Origin state is required." }
    }

    const riderShareBps = Math.round(riderSharePercent * 100)
    const corporateDeliveryShareBps = Math.round(corporateDeliverySharePercent * 100)

    if (
        riderShareBps < 0
        || riderShareBps > 10_000
        || corporateDeliveryShareBps < 0
        || corporateDeliveryShareBps > 10_000
    ) {
        return { error: "Rider and corporate shares must stay between 0% and 100%." }
    }

    if (riderShareBps + corporateDeliveryShareBps !== 10_000) {
        return { error: "Rider and corporate shares must add up to exactly 100%." }
    }

    const value = {
        base_fare_kobo: nairaToKobo(baseFareNaira),
        distance_rate_kobo_per_km: nairaToKobo(distanceRateNairaPerKm),
        rider_share_bps: riderShareBps,
        corporate_delivery_share_bps: corporateDeliveryShareBps,
        origin_lat: originLat,
        origin_lng: originLng,
        origin_state: originState,
    }

    const { error } = await upsertSetting(
        supabase,
        "delivery_settings",
        value,
        "Configurable delivery base fare, distance rate, and delivery revenue split."
    )

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_delivery_settings",
        entityType: "app_setting",
        entityId: "delivery_settings",
        metadata: value,
    })

    revalidatePath("/dashboard/delivery-settings")
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/reports")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function updatePlatformFinancialSettings(formData: FormData) {
    const actor = await getActorContext("settings")
    const supabase = actor.supabase

    const value = {
        agent_fee_bps: Math.round(Number(formData.get("agent_fee_percent") ?? 0) * 100),
        app_fee_bps: Math.round(Number(formData.get("app_fee_percent") ?? 0) * 100),
        ops_fee_bps: Math.round(Number(formData.get("ops_fee_percent") ?? 0) * 100),
        vat_bps: Math.round(Number(formData.get("vat_percent") ?? 0) * 100),
        insurance_default_kobo: nairaToKobo(Number(formData.get("insurance_default_naira") ?? 0)),
    }

    const { error } = await upsertSetting(
        supabase,
        "platform_financial_settings",
        value,
        "Configurable product fee structure for merchant, agent, app, overhead, insurance, and VAT."
    )

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_platform_financial_settings",
        entityType: "app_setting",
        entityId: "platform_financial_settings",
        metadata: value,
    })

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/approvals")
    revalidatePath("/dashboard/reports")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function updateAssignmentSettings(formData: FormData) {
    const actor = await getActorContext("settings")
    const supabase = actor.supabase

    const value = {
        rider_radius_meters: Number(formData.get("rider_radius_meters") ?? 0),
        auto_assignment_strategy: String(formData.get("auto_assignment_strategy") ?? "balanced_auto"),
    }

    const { error } = await upsertSetting(
        supabase,
        "assignment_settings",
        value,
        "Configurable rider discovery and assignment automation rules."
    )

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_assignment_settings",
        entityType: "app_setting",
        entityId: "assignment_settings",
        metadata: value,
    })

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function updateWalletWithdrawalSettings(formData: FormData) {
    const actor = await getActorContext("settings")
    const supabase = actor.supabase

    const roleWalletWithdrawalMode = String(formData.get("role_wallet_withdrawal_mode") ?? "month_end_only")

    if (!["anytime", "month_end_only"].includes(roleWalletWithdrawalMode)) {
        return { error: "Choose a valid operational wallet withdrawal mode." }
    }

    const value = {
        role_wallet_withdrawal_mode: roleWalletWithdrawalMode,
    }

    const { error } = await upsertSetting(
        supabase,
        WALLET_WITHDRAWAL_SETTINGS_KEY,
        value,
        "Controls whether operational role wallets can be withdrawn anytime or only on the last day of the month in Africa/Lagos."
    )

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_wallet_withdrawal_settings",
        entityType: "app_setting",
        entityId: WALLET_WITHDRAWAL_SETTINGS_KEY,
        metadata: value,
    })

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/settings/wallet-withdrawals")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function updateMerchantLocationPolicy(formData: FormData) {
    const actor = await getActorContext("location_access")
    const supabase = actor.supabase

    const value = {
        request_cooldown_enabled: String(formData.get("request_cooldown_enabled") ?? "off") === "on",
        request_cooldown_hours: Math.max(0, Number(formData.get("request_cooldown_hours") ?? 0)),
    }

    const { error } = await upsertSetting(
        supabase,
        "merchant_location_policy",
        value,
        "Controls how often merchants can request store-location edit access."
    )

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_merchant_location_policy",
        entityType: "app_setting",
        entityId: "merchant_location_policy",
        metadata: value,
    })

    revalidatePath("/dashboard/location-access")
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function approveMerchantLocationRequest(formData: FormData) {
    const actor = await getActorContext("location_access")
    const supabase = actor.supabase

    const merchantId = String(formData.get("merchant_id") ?? "")

    if (!merchantId) {
        return { error: "Merchant ID is required." }
    }

    const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({
            update_requested: false,
            location_locked: false,
        })
        .eq("id", merchantId)
        .eq("update_requested", true)
        .select("id")
        .maybeSingle()

    if (error) {
        return { error: error.message }
    }

    if (!updatedProfile) {
        return { error: "This merchant no longer has a pending location request." }
    }

    await createNotification(supabase, {
        userId: merchantId,
        title: "Location edit approved",
        message: "Admin approved your store location update request. You can now open the location page and save a new store pin.",
        type: "location_access",
        actionUrl: "/merchant/verify-location",
        metadata: {
            status: "approved",
        },
    })

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "approve_merchant_location_request",
        entityType: "profile",
        entityId: merchantId,
        metadata: {
            location_locked: false,
        },
    })

    revalidatePath("/dashboard/location-access")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function denyMerchantLocationRequest(formData: FormData) {
    const actor = await getActorContext("location_access")
    const supabase = actor.supabase

    const merchantId = String(formData.get("merchant_id") ?? "")

    if (!merchantId) {
        return { error: "Merchant ID is required." }
    }

    const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({
            update_requested: false,
            location_locked: true,
        })
        .eq("id", merchantId)
        .eq("update_requested", true)
        .select("id")
        .maybeSingle()

    if (error) {
        return { error: error.message }
    }

    if (!updatedProfile) {
        return { error: "This merchant no longer has a pending location request." }
    }

    await createNotification(supabase, {
        userId: merchantId,
        title: "Location edit declined",
        message: "Admin declined your store location update request. You can submit another request after the active cooldown window.",
        type: "location_access",
        actionUrl: "/merchant/verify-location",
        metadata: {
            status: "denied",
        },
    })

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "deny_merchant_location_request",
        entityType: "profile",
        entityId: merchantId,
        metadata: {
            location_locked: true,
        },
    })

    revalidatePath("/dashboard/location-access")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function reassignOrder(formData: FormData) {
    const actor = await getActorContext("orders")
    const supabase = actor.supabase

    const orderId = String(formData.get("order_id") ?? "")
    const assignmentRole = String(formData.get("assignment_role") ?? "")
    const newAssigneeId = String(formData.get("new_assignee_id") ?? "")
    const reason = String(formData.get("reason") ?? "")

    if (!orderId || !assignmentRole || !newAssigneeId || !reason) {
        return { error: "Order, role, assignee, and reason are required." }
    }

    const { error } = await supabase.rpc("override_order_assignment", {
        p_order_id: orderId,
        p_assignment_role: assignmentRole,
        p_new_assignee_id: newAssigneeId,
        p_reason: reason,
    })

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "override_order_assignment",
        entityType: "order",
        entityId: orderId,
        metadata: {
            assignment_role: assignmentRole,
            new_assignee_id: newAssigneeId,
            reason,
        },
    })

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function resolveDisputeAction(formData: FormData) {
    const actor = await getActorContext("orders")
    const supabase = actor.supabase

    const disputeId = String(formData.get("dispute_id") ?? "")
    const status = String(formData.get("status") ?? "")
    const resolutionNotes = String(formData.get("resolution_notes") ?? "")

    if (!disputeId || !status) {
        return { error: "Dispute and status are required." }
    }

    const { error } = await supabase.rpc("resolve_order_dispute", {
        p_dispute_id: disputeId,
        p_status: status,
        p_resolution_notes: resolutionNotes,
    })

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "resolve_order_dispute",
        entityType: "order_dispute",
        entityId: disputeId,
        metadata: {
            status,
            resolution_notes: resolutionNotes,
        },
    })

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/reports")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function createRefundAction(formData: FormData) {
    const actor = await getActorContext("orders")
    const supabase = actor.supabase

    const orderId = String(formData.get("order_id") ?? "")
    const amountNaira = Number(formData.get("amount_naira") ?? 0)
    const reason = String(formData.get("reason") ?? "")

    if (!orderId || amountNaira <= 0 || !reason) {
        return { error: "Order, refund amount, and reason are required." }
    }

    const { error } = await supabase.rpc("create_refund", {
        p_order_id: orderId,
        p_amount_kobo: nairaToKobo(amountNaira),
        p_reason: reason,
    })

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "create_refund",
        entityType: "order",
        entityId: orderId,
        metadata: {
            amount_kobo: nairaToKobo(amountNaira),
            reason,
        },
    })

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/reports")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function processRefundAction(formData: FormData) {
    const actor = await getActorContext("orders")
    const supabase = actor.supabase

    const refundId = String(formData.get("refund_id") ?? "")

    if (!refundId) {
        return { error: "Refund ID is required." }
    }

    const { error } = await supabase.rpc("process_refund", {
        p_refund_id: refundId,
    })

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "process_refund",
        entityType: "refund",
        entityId: refundId,
    })

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/reports")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}
