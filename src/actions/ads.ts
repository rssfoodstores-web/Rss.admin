"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { deleteAdCloudinaryAsset } from "@/app/actions/adMediaActions"
import {
    type AdMediaType,
    type AdPlacement,
    getAdPlacementLabel,
} from "@/lib/ad-campaigns"
import type { Tables } from "@/types/database.types"

type AdRow = Tables<"ads">

export interface AdsAdminCampaign {
    id: string
    title: string
    body: string
    placement: AdPlacement
    placementLabel: string
    mediaUrl: string
    mediaType: AdMediaType
    publicId: string
    clickUrl: string
    ctaLabel: string
    isActive: boolean
    sortOrder: number
    impressionCount: number
    clickCount: number
    ctrPercent: number
    campaignStartsAt: string | null
    campaignEndsAt: string | null
    createdAt: string | null
    updatedAt: string | null
    lastImpressionAt: string | null
    lastClickAt: string | null
    isLiveNow: boolean
}

export interface AdsDashboardData {
    campaigns: AdsAdminCampaign[]
    stats: {
        totalCampaigns: number
        liveCampaigns: number
        totalImpressions: number
        totalClicks: number
        averageCtrPercent: number
    }
    placementTotals: Array<{
        placement: AdPlacement
        label: string
        campaignCount: number
        liveCampaignCount: number
        impressions: number
        clicks: number
    }>
}

export interface SaveAdCampaignInput {
    id?: string
    title: string
    body?: string | null
    placement: AdPlacement
    mediaUrl: string
    mediaType: AdMediaType
    publicId: string
    clickUrl: string
    ctaLabel?: string | null
    sortOrder?: number
    isActive?: boolean
    campaignStartsAt?: string | null
    campaignEndsAt?: string | null
    previousPublicId?: string | null
    previousMediaType?: AdMediaType | null
}

function isLiveNow(row: AdRow) {
    const now = Date.now()
    const startsAt = row.campaign_starts_at ? new Date(row.campaign_starts_at).getTime() : null
    const endsAt = row.campaign_ends_at ? new Date(row.campaign_ends_at).getTime() : null

    return Boolean(row.is_active)
        && (startsAt === null || startsAt <= now)
        && (endsAt === null || endsAt >= now)
}

function normalizeAdCampaign(row: AdRow): AdsAdminCampaign {
    const impressionCount = Number(row.impression_count ?? 0)
    const clickCount = Number(row.click_count ?? 0)

    return {
        id: row.id,
        title: row.title,
        body: row.body ?? "",
        placement: row.placement as AdPlacement,
        placementLabel: getAdPlacementLabel(row.placement),
        mediaUrl: row.media_url,
        mediaType: row.media_type as AdMediaType,
        publicId: row.public_id ?? "",
        clickUrl: row.click_url,
        ctaLabel: row.cta_label,
        isActive: Boolean(row.is_active),
        sortOrder: Number(row.sort_order ?? 0),
        impressionCount,
        clickCount,
        ctrPercent: impressionCount > 0 ? Number(((clickCount / impressionCount) * 100).toFixed(2)) : 0,
        campaignStartsAt: row.campaign_starts_at ?? null,
        campaignEndsAt: row.campaign_ends_at ?? null,
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
        lastImpressionAt: row.last_impression_at ?? null,
        lastClickAt: row.last_click_at ?? null,
        isLiveNow: isLiveNow(row),
    }
}

function normalizeOptionalText(value: string | null | undefined) {
    const trimmed = value?.trim() ?? ""
    return trimmed.length > 0 ? trimmed : null
}

function normalizeClickUrl(value: string) {
    const trimmed = value.trim()

    if (!trimmed) {
        throw new Error("Click URL is required.")
    }

    if (trimmed.startsWith("/")) {
        return trimmed
    }

    try {
        const url = new URL(trimmed)
        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Click URL must use http, https, or a relative path.")
        }
        return url.toString()
    } catch {
        throw new Error("Enter a valid click URL or relative path.")
    }
}

function normalizeCampaignWindow(startsAt?: string | null, endsAt?: string | null) {
    const normalizedStartsAt = normalizeOptionalText(startsAt)
    const normalizedEndsAt = normalizeOptionalText(endsAt)

    if (
        normalizedStartsAt
        && normalizedEndsAt
        && new Date(normalizedEndsAt).getTime() <= new Date(normalizedStartsAt).getTime()
    ) {
        throw new Error("Campaign end must be after campaign start.")
    }

    return {
        campaign_ends_at: normalizedEndsAt,
        campaign_starts_at: normalizedStartsAt,
    }
}

async function revalidateAdsPages() {
    revalidatePath("/dashboard/ads")
    revalidatePath("/")
    revalidatePath("/retail")
    revalidatePath("/wholesale")
    revalidatePath("/discount-bundles")
    revalidatePath("/contact")
    revalidatePath("/account")
}

export async function getAdsDashboard(): Promise<AdsDashboardData> {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase

    const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching ads dashboard:", error)
        return {
            campaigns: [],
            stats: {
                totalCampaigns: 0,
                liveCampaigns: 0,
                totalImpressions: 0,
                totalClicks: 0,
                averageCtrPercent: 0,
            },
            placementTotals: [],
        }
    }

    const campaigns = ((data ?? []) as AdRow[]).map(normalizeAdCampaign)
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + campaign.impressionCount, 0)
    const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clickCount, 0)

    const placementTotals = Array.from(
        campaigns.reduce((map, campaign) => {
            const current = map.get(campaign.placement) ?? {
                placement: campaign.placement,
                label: campaign.placementLabel,
                campaignCount: 0,
                liveCampaignCount: 0,
                impressions: 0,
                clicks: 0,
            }

            current.campaignCount += 1
            current.liveCampaignCount += campaign.isLiveNow ? 1 : 0
            current.impressions += campaign.impressionCount
            current.clicks += campaign.clickCount
            map.set(campaign.placement, current)
            return map
        }, new Map<AdPlacement, {
            placement: AdPlacement
            label: string
            campaignCount: number
            liveCampaignCount: number
            impressions: number
            clicks: number
        }>())
            .values()
    ).sort((left, right) => right.impressions - left.impressions)

    return {
        campaigns,
        stats: {
            totalCampaigns: campaigns.length,
            liveCampaigns: campaigns.filter((campaign) => campaign.isLiveNow).length,
            totalImpressions,
            totalClicks,
            averageCtrPercent: totalImpressions > 0
                ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
                : 0,
        },
        placementTotals,
    }
}

export async function saveAdCampaign(input: SaveAdCampaignInput) {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase

    const title = input.title.trim()
    if (!title) {
        return { error: "Campaign title is required." }
    }

    if (!input.mediaUrl.trim() || !input.publicId.trim()) {
        return { error: "Upload the campaign media before saving." }
    }

    try {
        const payload = {
            title,
            body: normalizeOptionalText(input.body),
            placement: input.placement,
            media_url: input.mediaUrl.trim(),
            media_type: input.mediaType,
            public_id: input.publicId.trim(),
            click_url: normalizeClickUrl(input.clickUrl),
            cta_label: normalizeOptionalText(input.ctaLabel) ?? "Open campaign",
            is_active: input.isActive ?? true,
            sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder ?? 0) : 0,
            ...normalizeCampaignWindow(input.campaignStartsAt, input.campaignEndsAt),
        }

        if (input.id) {
            const { error } = await supabase
                .from("ads")
                .update(payload)
                .eq("id", input.id)

            if (error) {
                throw error
            }
        } else {
            const { error } = await supabase
                .from("ads")
                .insert(payload)

            if (error) {
                throw error
            }
        }

        if (
            input.previousPublicId
            && input.previousPublicId !== input.publicId
            && input.previousMediaType
        ) {
            try {
                await deleteAdCloudinaryAsset(input.previousPublicId, input.previousMediaType)
            } catch (cleanupError) {
                console.error("Unable to remove replaced ad asset:", cleanupError)
            }
        }

        await revalidateAdsPages()
        return { success: true }
    } catch (error) {
        console.error("Error saving ad campaign:", error)
        return {
            error: error instanceof Error ? error.message : "Unable to save ad campaign.",
        }
    }
}

export async function deleteAdCampaign(id: string, publicId?: string, mediaType?: AdMediaType) {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase

    if (!id) {
        return { error: "Campaign ID is required." }
    }

    const { error } = await supabase
        .from("ads")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting ad campaign:", error)
        return { error: "Failed to delete ad campaign." }
    }

    if (publicId && mediaType) {
        try {
            await deleteAdCloudinaryAsset(publicId, mediaType)
        } catch (cleanupError) {
            console.error("Unable to remove deleted ad asset:", cleanupError)
        }
    }

    await revalidateAdsPages()
    return { success: true }
}

export async function toggleAdCampaignStatus(id: string, currentStatus: boolean) {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase

    const { error } = await supabase
        .from("ads")
        .update({ is_active: !currentStatus })
        .eq("id", id)

    if (error) {
        console.error("Error updating ad campaign status:", error)
        return { error: "Failed to update campaign status." }
    }

    await revalidateAdsPages()
    return { success: true }
}
