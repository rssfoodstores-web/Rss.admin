"use server"

import { revalidatePath } from "next/cache"
import { deleteCookOffCloudinaryAsset } from "@/app/actions/cookOffMediaActions"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    groupCookOffRankingsBySession,
    type CookOffEntryRow,
    type CookOffRankedEntry,
    type CookOffScoreboardRow,
    type CookOffSessionRow,
} from "@/lib/cookOff"
import type { Tables } from "@/types/database.types"

type HeroSlideRow = Tables<"hero_carousel_slides">

interface SaveHeroSlideInput {
    bodyText?: string
    buttonText?: string
    buttonUrl?: string
    eyebrowText?: string
    highlightText?: string
    isActive: boolean
    marketingMode: string
    mediaPublicId: string
    mediaType: string
    mediaUrl: string
    sortOrder: number
    title: string
}

interface SaveCookOffSessionInput {
    ctaText?: string
    description?: string
    heroMediaPublicId?: string
    heroMediaType?: string
    heroMediaUrl?: string
    monthLabel: string
    prizes?: string
    rules?: string
    slug: string
    status: string
    summary?: string
    theme: string
    title: string
}

interface SaveCookOffReviewInput {
    adminCreativityScore?: number | null
    adminFeedback?: string
    adminPresentationScore?: number | null
    entryId: string
    isFeatured: boolean
    status: "approved" | "rejected"
    winnerPosition?: number | null
}

export interface CookOffAdminEntryViewModel {
    adminCreativityScore: number | null
    adminFeedback: string | null
    adminPresentationScore: number | null
    adminScore: number | null
    createdAt: string
    entryCode: string
    id: string
    ingredients: string
    isFeatured: boolean
    presentationVideoUrl: string
    cookingProcessVideoUrl: string
    rank: number | null
    recipeName: string
    reviewedAt: string | null
    sessionId: string
    sessionMonthLabel: string
    sessionStatus: string
    sessionTitle: string
    status: string
    submitterEmail: string
    submitterName: string
    submitterPhone: string | null
    userId: string
    voteCount: number
    winnerPosition: number | null
}

export interface CookOffAdminDashboard {
    entries: CookOffAdminEntryViewModel[]
    sessions: CookOffSessionRow[]
    slides: HeroSlideRow[]
    stats: {
        activeSlides: number
        approvedEntries: number
        pendingEntries: number
        rejectedEntries: number
        totalEntries: number
        totalSessions: number
    }
}

function nullIfEmpty(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : null
}

function validateStatus(status: string) {
    if (!["draft", "active", "archived"].includes(status)) {
        throw new Error("Invalid Cook-Off session status.")
    }

    return status as "draft" | "active" | "archived"
}

async function requireAdmin() {
    return requireAdminRouteAccess("cook_off")
}

function buildAdminEntryViewModel(
    entry: CookOffEntryRow,
    session: CookOffSessionRow | undefined,
    ranking: CookOffRankedEntry | undefined
): CookOffAdminEntryViewModel {
    return {
        adminCreativityScore: ranking?.adminCreativityScore ?? entry.admin_creativity_score ?? null,
        adminFeedback: entry.admin_feedback ?? null,
        adminPresentationScore: ranking?.adminPresentationScore ?? entry.admin_presentation_score ?? null,
        adminScore: ranking?.adminScore ?? null,
        cookingProcessVideoUrl: entry.cooking_process_video_url,
        createdAt: entry.created_at,
        entryCode: entry.entry_code,
        id: entry.id,
        ingredients: entry.ingredients,
        isFeatured: ranking?.isFeatured ?? entry.is_featured,
        presentationVideoUrl: entry.presentation_video_url,
        rank: ranking?.rank ?? null,
        recipeName: entry.recipe_name,
        reviewedAt: entry.reviewed_at,
        sessionId: entry.session_id,
        sessionMonthLabel: session?.month_label ?? "Cook-Off Session",
        sessionStatus: session?.status ?? "archived",
        sessionTitle: session?.title ?? "Cook-Off",
        status: entry.status,
        submitterEmail: entry.submitter_email,
        submitterName: entry.submitter_name,
        submitterPhone: entry.submitter_phone,
        userId: entry.user_id,
        voteCount: ranking?.voteCount ?? 0,
        winnerPosition: ranking?.winnerPosition ?? entry.winner_position ?? null,
    }
}

function revalidateCookOffPaths() {
    revalidatePath("/dashboard/cook-off")
    revalidatePath("/dashboard/settings")
    revalidatePath("/cook-off")
    revalidatePath("/")
    revalidatePath("/retail")
    revalidatePath("/wholesale")
    revalidatePath("/account/cook-off")
}

export async function getCookOffAdminData(): Promise<CookOffAdminDashboard> {
    const { supabase } = await requireAdmin()
    const [{ data: slidesData, error: slidesError }, { data: sessionsData, error: sessionsError }, { data: entriesData, error: entriesError }, { data: scoreboardData, error: scoreboardError }] = await Promise.all([
        supabase
            .from("hero_carousel_slides")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        supabase
            .from("cook_off_sessions")
            .select("*")
            .order("created_at", { ascending: false }),
        supabase
            .from("cook_off_entries")
            .select("*")
            .order("created_at", { ascending: false }),
        supabase
            .from("cook_off_entry_scoreboard")
            .select("*"),
    ])

    if (slidesError) throw new Error(slidesError.message)
    if (sessionsError) throw new Error(sessionsError.message)
    if (entriesError) throw new Error(entriesError.message)
    if (scoreboardError) throw new Error(scoreboardError.message)

    const slides = (slidesData ?? []) as HeroSlideRow[]
    const sessions = (sessionsData ?? []) as CookOffSessionRow[]
    const entries = (entriesData ?? []) as CookOffEntryRow[]
    const rankingsBySession = groupCookOffRankingsBySession((scoreboardData ?? []) as CookOffScoreboardRow[])
    const sessionsById = new Map(sessions.map((session) => [session.id, session]))
    const rankingsByEntryId = new Map(
        Array.from(rankingsBySession.values()).flatMap((sessionEntries) => sessionEntries.map((entry) => [entry.entryId, entry]))
    )

    return {
        entries: entries.map((entry) =>
            buildAdminEntryViewModel(entry, sessionsById.get(entry.session_id), rankingsByEntryId.get(entry.id))
        ),
        sessions,
        slides,
        stats: {
            activeSlides: slides.filter((slide) => slide.is_active).length,
            approvedEntries: entries.filter((entry) => entry.status === "approved").length,
            pendingEntries: entries.filter((entry) => entry.status === "pending").length,
            rejectedEntries: entries.filter((entry) => entry.status === "rejected").length,
            totalEntries: entries.length,
            totalSessions: sessions.length,
        },
    }
}

async function archiveOtherActiveSessions(excludedId: string | null, updatedBy: string) {
    const { supabase } = await requireAdmin()
    let query = supabase
        .from("cook_off_sessions")
        .update({
            status: "archived",
            updated_by: updatedBy,
        })
        .eq("status", "active")

    if (excludedId) {
        query = query.neq("id", excludedId)
    }

    const { error } = await query

    if (error) {
        throw new Error(error.message)
    }
}

export async function createHeroSlide(input: SaveHeroSlideInput) {
    const { supabase, user } = await requireAdmin()

    if (!input.title.trim()) {
        throw new Error("Slide title is required.")
    }

    const { error } = await supabase.from("hero_carousel_slides").insert({
        body_text: nullIfEmpty(input.bodyText),
        button_text: nullIfEmpty(input.buttonText),
        button_url: nullIfEmpty(input.buttonUrl),
        created_by: user.id,
        eyebrow_text: nullIfEmpty(input.eyebrowText),
        highlight_text: nullIfEmpty(input.highlightText),
        is_active: input.isActive,
        marketing_mode: input.marketingMode || "standard",
        media_public_id: input.mediaPublicId.trim(),
        media_type: input.mediaType,
        media_url: input.mediaUrl.trim(),
        sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
        title: input.title.trim(),
        updated_by: user.id,
    })

    if (error) {
        throw new Error(error.message)
    }

    revalidateCookOffPaths()
    return { success: true }
}

export async function updateHeroSlide(slideId: string, input: SaveHeroSlideInput) {
    const { supabase, user } = await requireAdmin()
    const { data: existingSlide, error: existingError } = await supabase
        .from("hero_carousel_slides")
        .select("*")
        .eq("id", slideId)
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const { error } = await supabase
        .from("hero_carousel_slides")
        .update({
            body_text: nullIfEmpty(input.bodyText),
            button_text: nullIfEmpty(input.buttonText),
            button_url: nullIfEmpty(input.buttonUrl),
            eyebrow_text: nullIfEmpty(input.eyebrowText),
            highlight_text: nullIfEmpty(input.highlightText),
            is_active: input.isActive,
            marketing_mode: input.marketingMode || "standard",
            media_public_id: input.mediaPublicId.trim(),
            media_type: input.mediaType,
            media_url: input.mediaUrl.trim(),
            sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
            title: input.title.trim(),
            updated_by: user.id,
        })
        .eq("id", slideId)

    if (error) {
        throw new Error(error.message)
    }

    try {
        if (existingSlide.media_public_id !== input.mediaPublicId.trim()) {
            await deleteCookOffCloudinaryAsset(existingSlide.media_public_id, existingSlide.media_type as "image" | "video")
        }
    } catch {
    }

    revalidateCookOffPaths()
    return { success: true }
}

export async function deleteHeroSlide(slideId: string) {
    const { supabase } = await requireAdmin()
    const { data: existingSlide, error: existingError } = await supabase
        .from("hero_carousel_slides")
        .select("*")
        .eq("id", slideId)
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const { error } = await supabase
        .from("hero_carousel_slides")
        .delete()
        .eq("id", slideId)

    if (error) {
        throw new Error(error.message)
    }

    try {
        await deleteCookOffCloudinaryAsset(existingSlide.media_public_id, existingSlide.media_type as "image" | "video")
    } catch {
    }

    revalidateCookOffPaths()
    return { success: true }
}

export async function createCookOffSession(input: SaveCookOffSessionInput) {
    const { supabase, user } = await requireAdmin()
    const status = validateStatus(input.status)

    if (status === "active") {
        await archiveOtherActiveSessions(null, user.id)
    }

    const { error } = await supabase.from("cook_off_sessions").insert({
        created_by: user.id,
        cta_text: nullIfEmpty(input.ctaText) ?? "Submit your entry",
        description: nullIfEmpty(input.description),
        hero_media_public_id: nullIfEmpty(input.heroMediaPublicId),
        hero_media_type: nullIfEmpty(input.heroMediaType),
        hero_media_url: nullIfEmpty(input.heroMediaUrl),
        month_label: input.monthLabel.trim(),
        prizes: nullIfEmpty(input.prizes),
        rules: nullIfEmpty(input.rules),
        slug: input.slug.trim().toLowerCase(),
        status,
        summary: nullIfEmpty(input.summary),
        theme: input.theme.trim(),
        title: input.title.trim(),
        updated_by: user.id,
    })

    if (error) {
        if (error.code === "23505") {
            throw new Error("That session slug is already in use.")
        }

        throw new Error(error.message)
    }

    revalidateCookOffPaths()
    return { success: true }
}

export async function updateCookOffSession(sessionId: string, input: SaveCookOffSessionInput) {
    const { supabase, user } = await requireAdmin()
    const status = validateStatus(input.status)
    const { data: existingSession, error: existingError } = await supabase
        .from("cook_off_sessions")
        .select("*")
        .eq("id", sessionId)
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    if (status === "active") {
        await archiveOtherActiveSessions(sessionId, user.id)
    }

    const { error } = await supabase
        .from("cook_off_sessions")
        .update({
            cta_text: nullIfEmpty(input.ctaText) ?? "Submit your entry",
            description: nullIfEmpty(input.description),
            hero_media_public_id: nullIfEmpty(input.heroMediaPublicId),
            hero_media_type: nullIfEmpty(input.heroMediaType),
            hero_media_url: nullIfEmpty(input.heroMediaUrl),
            month_label: input.monthLabel.trim(),
            prizes: nullIfEmpty(input.prizes),
            rules: nullIfEmpty(input.rules),
            slug: input.slug.trim().toLowerCase(),
            status,
            summary: nullIfEmpty(input.summary),
            theme: input.theme.trim(),
            title: input.title.trim(),
            updated_by: user.id,
        })
        .eq("id", sessionId)

    if (error) {
        if (error.code === "23505") {
            throw new Error("That session slug is already in use.")
        }

        throw new Error(error.message)
    }

    try {
        const nextPublicId = nullIfEmpty(input.heroMediaPublicId)
        if (existingSession.hero_media_public_id && existingSession.hero_media_public_id !== nextPublicId) {
            await deleteCookOffCloudinaryAsset(existingSession.hero_media_public_id, (existingSession.hero_media_type as "image" | "video") ?? "image")
        }
    } catch {
    }

    revalidateCookOffPaths()
    return { success: true }
}

export async function saveCookOffReview(input: SaveCookOffReviewInput) {
    const { supabase, user } = await requireAdmin()
    const { data: existingEntry, error: existingError } = await supabase
        .from("cook_off_entries")
        .select("*")
        .eq("id", input.entryId)
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const normalizedFeedback = nullIfEmpty(input.adminFeedback)
    const winnerPosition = input.status === "approved" ? input.winnerPosition ?? null : null
    const isFeatured = input.status === "approved" ? input.isFeatured : false

    const { error } = await supabase
        .from("cook_off_entries")
        .update({
            admin_creativity_score: input.adminCreativityScore ?? null,
            admin_feedback: normalizedFeedback,
            admin_presentation_score: input.adminPresentationScore ?? null,
            is_featured: isFeatured,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            status: input.status,
            winner_position: winnerPosition,
        })
        .eq("id", input.entryId)

    if (error) {
        throw new Error(error.message)
    }

    if (input.status === "approved" && existingEntry.status !== "approved") {
        await supabase.from("notifications").insert({
            action_url: "/account/cook-off",
            message: `Your Cook-Off entry ${existingEntry.entry_code} has been approved and is now live in the monthly challenge.`,
            title: "Cook-Off entry approved",
            type: "cook_off_approved",
            user_id: existingEntry.user_id,
        })
    }

    if (input.status === "rejected" && (existingEntry.status !== "rejected" || existingEntry.admin_feedback !== normalizedFeedback)) {
        await supabase.from("notifications").insert({
            action_url: "/account/cook-off",
            message: `Your Cook-Off entry ${existingEntry.entry_code} was reviewed. Open your Cook-Off page to see admin feedback.`,
            title: "Cook-Off entry update",
            type: "cook_off_rejected",
            user_id: existingEntry.user_id,
        })
    }

    if (winnerPosition && existingEntry.winner_position !== winnerPosition) {
        await supabase.from("notifications").insert({
            action_url: "/account/cook-off",
            message: `Your Cook-Off entry ${existingEntry.entry_code} finished as winner #${winnerPosition} in the monthly challenge.`,
            title: "Cook-Off result",
            type: "cook_off_winner",
            user_id: existingEntry.user_id,
        })
    }

    revalidateCookOffPaths()
    revalidatePath("/account/notifications")
    return { success: true }
}
