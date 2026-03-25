"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

interface ReferralAdminStats {
    totalReferrals: number
    activeReferrers: number
    totalRewardsKobo: number
    rewardEvents: number
}

export interface ReferralLeaderboardItem {
    rank: number
    referrerId: string
    fullName: string
    referralCode: string
    totalReferrals: number
    rewardEvents: number
    totalEarningsKobo: number
}

export interface ReferralRewardActivity {
    id: string
    createdAt: string
    sourceKind: string
    sourceAmountKobo: number
    commissionAmountKobo: number
    referrerId: string
    referrerName: string
    referredUserId: string
    referredUserName: string
}

export interface ReferralAdminDashboard {
    commissionBps: number
    stats: ReferralAdminStats
    leaderboard: ReferralLeaderboardItem[]
    recentRewards: ReferralRewardActivity[]
}

type ReferralAdminDashboardRpc = {
    success?: boolean
    error?: string
    commission_bps?: number
    stats?: {
        total_referrals?: number
        active_referrers?: number
        total_rewards_kobo?: number
        reward_events?: number
    }
    leaderboard?: Array<{
        rank?: number
        referrer_id?: string
        full_name?: string
        referral_code?: string
        total_referrals?: number
        reward_events?: number
        total_earnings_kobo?: number
    }>
    recent_rewards?: Array<{
        id?: string
        created_at?: string
        source_kind?: string
        source_amount_kobo?: number
        commission_amount_kobo?: number
        referrer_id?: string
        referrer_name?: string
        referred_user_id?: string
        referred_user_name?: string
    }>
}

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0
}

async function checkAdmin() {
    const access = await requireAdminRouteAccess("referrals")
    return access.supabase
}

export async function getReferralAdminData(): Promise<ReferralAdminDashboard> {
    const supabase = await checkAdmin()
    const { data, error } = await supabase.rpc("get_referral_admin_dashboard", {
        p_limit: 12,
    })

    if (error) {
        throw new Error(error.message)
    }

    const dashboard = (data ?? {}) as ReferralAdminDashboardRpc

    if (dashboard.success === false) {
        throw new Error(dashboard.error ?? "Unable to load referral dashboard")
    }

    return {
        commissionBps: toNumber(dashboard.commission_bps),
        stats: {
            totalReferrals: toNumber(dashboard.stats?.total_referrals),
            activeReferrers: toNumber(dashboard.stats?.active_referrers),
            totalRewardsKobo: toNumber(dashboard.stats?.total_rewards_kobo),
            rewardEvents: toNumber(dashboard.stats?.reward_events),
        },
        leaderboard: Array.isArray(dashboard.leaderboard)
            ? dashboard.leaderboard.map((item) => ({
                rank: toNumber(item.rank),
                referrerId: String(item.referrer_id ?? ""),
                fullName: String(item.full_name ?? "RSS User"),
                referralCode: String(item.referral_code ?? ""),
                totalReferrals: toNumber(item.total_referrals),
                rewardEvents: toNumber(item.reward_events),
                totalEarningsKobo: toNumber(item.total_earnings_kobo),
            }))
            : [],
        recentRewards: Array.isArray(dashboard.recent_rewards)
            ? dashboard.recent_rewards.map((item) => ({
                id: String(item.id ?? ""),
                createdAt: String(item.created_at ?? ""),
                sourceKind: String(item.source_kind ?? "payout"),
                sourceAmountKobo: toNumber(item.source_amount_kobo),
                commissionAmountKobo: toNumber(item.commission_amount_kobo),
                referrerId: String(item.referrer_id ?? ""),
                referrerName: String(item.referrer_name ?? "RSS User"),
                referredUserId: String(item.referred_user_id ?? ""),
                referredUserName: String(item.referred_user_name ?? "RSS User"),
            }))
            : [],
    }
}

export async function updateReferralCommissionRate(percent: number) {
    const supabase = await checkAdmin()

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error("Referral percentage must be between 0 and 100.")
    }

    const basisPoints = Math.round(percent * 100)

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: "referral_commission_bps",
            value: basisPoints,
            description: "Referral commission rate in basis points. 100 = 1%.",
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/dashboard/referrals")
    revalidatePath("/dashboard/settings")
    revalidatePath("/account/referrals")

    return {
        success: true,
        basisPoints,
    }
}
