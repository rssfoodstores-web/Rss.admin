"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

export interface RewardAdminSettings {
    cookOffApprovedPoints: number
    cookOffFeaturedBonusPoints: number
    cookOffWinnerBonusPoints: number
    enabled: boolean
    expirationDays: number
    pointValueNaira: number
    purchasePointsPerSpendUnit: number
    purchaseSpendUnitNaira: number
    referralWelcomeBonusPoints: number
}

export interface RewardAdminStats {
    activeBalances: number
    outstandingAvailablePoints: number
    outstandingPendingPoints: number
    pointsExpired: number
    pointsIssued: number
    pointsRedeemed: number
}

export interface RewardAdminActivityItem {
    createdAt: string
    description: string
    eventType: string
    id: string
    pointsDelta: number
    sourceKind: string | null
    userId: string
    userName: string
}

export interface RewardAdminDashboard {
    activity: RewardAdminActivityItem[]
    settings: RewardAdminSettings
    stats: RewardAdminStats
}

const DEFAULT_SETTINGS: RewardAdminSettings = {
    cookOffApprovedPoints: 50,
    cookOffFeaturedBonusPoints: 75,
    cookOffWinnerBonusPoints: 200,
    enabled: true,
    expirationDays: 365,
    pointValueNaira: 1,
    purchasePointsPerSpendUnit: 1,
    purchaseSpendUnitNaira: 100,
    referralWelcomeBonusPoints: 150,
}

function toNumber(value: unknown, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampInteger(value: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
    return Math.min(Math.max(Math.round(value), minimum), maximum)
}

function normalizeSettings(value: unknown): RewardAdminSettings {
    const payload = value && typeof value === "object" ? value as Record<string, unknown> : {}

    return {
        cookOffApprovedPoints: clampInteger(toNumber(payload.cook_off_approved_points, DEFAULT_SETTINGS.cookOffApprovedPoints), 0),
        cookOffFeaturedBonusPoints: clampInteger(toNumber(payload.cook_off_featured_bonus_points, DEFAULT_SETTINGS.cookOffFeaturedBonusPoints), 0),
        cookOffWinnerBonusPoints: clampInteger(toNumber(payload.cook_off_winner_bonus_points, DEFAULT_SETTINGS.cookOffWinnerBonusPoints), 0),
        enabled: payload.enabled !== false,
        expirationDays: clampInteger(toNumber(payload.expiration_days, DEFAULT_SETTINGS.expirationDays), 1),
        pointValueNaira: Math.max(toNumber(payload.point_value_naira, DEFAULT_SETTINGS.pointValueNaira), 1),
        purchasePointsPerSpendUnit: clampInteger(toNumber(payload.purchase_points_per_spend_unit, DEFAULT_SETTINGS.purchasePointsPerSpendUnit), 0),
        purchaseSpendUnitNaira: clampInteger(toNumber(payload.purchase_spend_unit_naira, DEFAULT_SETTINGS.purchaseSpendUnitNaira), 1),
        referralWelcomeBonusPoints: clampInteger(toNumber(payload.referral_welcome_bonus_points, DEFAULT_SETTINGS.referralWelcomeBonusPoints), 0),
    }
}

async function checkAdmin() {
    const access = await requireAdminRouteAccess("rewards")
    return access.supabase
}

export async function getRewardAdminData(): Promise<RewardAdminDashboard> {
    const supabase = await checkAdmin()

    await supabase.rpc("process_reward_point_expiries", {
        p_user_id: null,
    })

    const [
        { data: settingRow, error: settingError },
        { data: balanceRows, error: balanceError },
        { data: statEvents, error: statEventsError },
        { data: activityRows, error: activityError },
    ] = await Promise.all([
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", "reward_system_settings")
            .maybeSingle(),
        supabase
            .from("reward_point_balances")
            .select("user_id, available_points, pending_points"),
        supabase
            .from("reward_point_events")
            .select("event_type, points_delta, source_kind"),
        supabase
            .from("reward_point_events")
            .select("id, user_id, event_type, points_delta, description, source_kind, created_at")
            .order("created_at", { ascending: false })
            .limit(20),
    ])

    if (settingError) {
        throw new Error(settingError.message)
    }

    if (balanceError) {
        throw new Error(balanceError.message)
    }

    if (statEventsError) {
        throw new Error(statEventsError.message)
    }

    if (activityError) {
        throw new Error(activityError.message)
    }

    const settings = normalizeSettings(settingRow?.value)
    const balances = balanceRows ?? []
    const userIds = Array.from(new Set((activityRows ?? []).map((row) => String(row.user_id)).filter(Boolean)))

    const { data: profiles, error: profilesError } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : { data: [], error: null }

    if (profilesError) {
        throw new Error(profilesError.message)
    }

    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? "RSS User"]))

    let pointsIssued = 0
    let pointsRedeemed = 0
    let pointsExpired = 0

    for (const event of statEvents ?? []) {
        if (event.event_type === "earned_available" && event.source_kind !== "redemption_restore") {
            pointsIssued += Math.max(toNumber(event.points_delta), 0)
        }

        if (event.event_type === "redeemed") {
            pointsRedeemed += Math.abs(toNumber(event.points_delta))
        }

        if (event.event_type === "expired") {
            pointsExpired += Math.abs(toNumber(event.points_delta))
        }
    }

    return {
        activity: (activityRows ?? []).map((row) => ({
            createdAt: String(row.created_at ?? ""),
            description: String(row.description ?? "Reward activity"),
            eventType: String(row.event_type ?? "activity"),
            id: String(row.id),
            pointsDelta: toNumber(row.points_delta),
            sourceKind: typeof row.source_kind === "string" ? row.source_kind : null,
            userId: String(row.user_id ?? ""),
            userName: profilesById.get(String(row.user_id ?? "")) ?? "RSS User",
        })),
        settings,
        stats: {
            activeBalances: balances.filter((row) => toNumber(row.available_points) > 0 || toNumber(row.pending_points) > 0).length,
            outstandingAvailablePoints: balances.reduce((sum, row) => sum + toNumber(row.available_points), 0),
            outstandingPendingPoints: balances.reduce((sum, row) => sum + toNumber(row.pending_points), 0),
            pointsExpired,
            pointsIssued,
            pointsRedeemed,
        },
    }
}

export async function updateRewardSettings(input: RewardAdminSettings) {
    const supabase = await checkAdmin()

    const settings = {
        enabled: Boolean(input.enabled),
        point_value_naira: Math.max(input.pointValueNaira, 1),
        purchase_points_per_spend_unit: clampInteger(input.purchasePointsPerSpendUnit, 0),
        purchase_spend_unit_naira: clampInteger(input.purchaseSpendUnitNaira, 1),
        expiration_days: clampInteger(input.expirationDays, 1),
        cook_off_approved_points: clampInteger(input.cookOffApprovedPoints, 0),
        cook_off_featured_bonus_points: clampInteger(input.cookOffFeaturedBonusPoints, 0),
        cook_off_winner_bonus_points: clampInteger(input.cookOffWinnerBonusPoints, 0),
        referral_welcome_bonus_points: clampInteger(input.referralWelcomeBonusPoints, 0),
        points_cover_delivery_fee: false,
    }

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: "reward_system_settings",
            value: settings,
            description: "Reward points system settings as JSON. Controls earning, redemption, and expiration behavior.",
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/dashboard/rewards")
    revalidatePath("/dashboard/settings")
    revalidatePath("/account/rewards")
    revalidatePath("/account/wallet")
    revalidatePath("/cart")

    return {
        success: true,
    }
}
