"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { deleteCookOffCloudinaryAsset } from "@/app/actions/cookOffMediaActions"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { getPrimaryAdminRole } from "@/lib/admin-routes"
import {
    DEFAULT_STOREFRONT_HERO_DRAFT,
    normalizeStorefrontHeroDefaultDraft,
    serializeStorefrontHeroDefaultDraft,
    STOREFRONT_HERO_DEFAULT_SETTING_KEY,
    type StorefrontHeroDefaultDraft,
} from "@/lib/storefront-hero"
import type { Tables } from "@/types/database.types"

type HeroSlideRow = Tables<"hero_carousel_slides">

interface SaveHeroSlideInput {
    bodyText?: string
    buttonText?: string
    buttonUrl?: string
    displayDurationSeconds: number
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

async function getActorContext() {
    const access = await requireAdminRouteAccess("hero_section")

    return {
        actorRole: getPrimaryAdminRole(access.roleNames) ?? "admin",
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

function nullIfEmpty(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : null
}

function normalizeMarketingMode(value: string | null | undefined) {
    return ["standard", "cook_off", "discount_bundles"].includes(value ?? "") ? value ?? "standard" : "standard"
}

function normalizeMediaType(value: string | null | undefined) {
    return value === "video" ? "video" : "image"
}

function normalizeDisplayDurationSeconds(value: number | null | undefined) {
    const normalized = Math.trunc(Number(value ?? 7))

    if (!Number.isFinite(normalized)) {
        return 7
    }

    return Math.min(Math.max(normalized, 2), 60)
}

function revalidateHeroPaths() {
    revalidatePath("/dashboard/hero-section")
    revalidatePath("/dashboard/settings")
    revalidatePath("/")
    revalidatePath("/retail")
    revalidatePath("/wholesale")
}

export interface StorefrontHeroAdminDashboard {
    defaultSlide: StorefrontHeroDefaultDraft
    slides: HeroSlideRow[]
    stats: {
        activeSlides: number
        totalSlides: number
        usesDefaultFallback: boolean
    }
}

export async function getStorefrontHeroAdminData(): Promise<StorefrontHeroAdminDashboard> {
    const { supabase } = await getActorContext()
    const [{ data: slidesData, error: slidesError }, { data: settingRow, error: settingError }] = await Promise.all([
        supabase
            .from("hero_carousel_slides")
            .select("*")
            .eq("placement", "storefront")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", STOREFRONT_HERO_DEFAULT_SETTING_KEY)
            .maybeSingle(),
    ])

    if (slidesError) {
        throw new Error(slidesError.message)
    }

    if (settingError) {
        throw new Error(settingError.message)
    }

    const slides = (slidesData ?? []) as HeroSlideRow[]
    const activeSlides = slides.filter((slide) => slide.is_active)

    return {
        defaultSlide: normalizeStorefrontHeroDefaultDraft(settingRow?.value ?? null),
        slides,
        stats: {
            activeSlides: activeSlides.length,
            totalSlides: slides.length,
            usesDefaultFallback: activeSlides.length === 0,
        },
    }
}

export async function updateStorefrontHeroDefaultSlide(input: StorefrontHeroDefaultDraft) {
    const actor = await getActorContext()
    const supabase = actor.supabase
    const nextValue = serializeStorefrontHeroDefaultDraft(input)

    const { data: existingSetting, error: existingError } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", STOREFRONT_HERO_DEFAULT_SETTING_KEY)
        .maybeSingle()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const previousDraft = normalizeStorefrontHeroDefaultDraft(existingSetting?.value ?? null)
    const { error } = await upsertSetting(
        supabase,
        STOREFRONT_HERO_DEFAULT_SETTING_KEY,
        nextValue,
        "Editable fallback storefront hero slide shown when no active storefront carousel slides are live."
    )

    if (error) {
        throw new Error(error.message)
    }

    try {
        if (previousDraft.mediaPublicId && previousDraft.mediaPublicId !== nextValue.media_public_id) {
            await deleteCookOffCloudinaryAsset(previousDraft.mediaPublicId, previousDraft.mediaType)
        }
    } catch {
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_storefront_hero_default_slide",
        entityId: STOREFRONT_HERO_DEFAULT_SETTING_KEY,
        entityType: "app_setting",
        metadata: nextValue,
    })

    revalidateHeroPaths()
    return { success: true }
}

export async function resetStorefrontHeroDefaultSlide() {
    return updateStorefrontHeroDefaultSlide(DEFAULT_STOREFRONT_HERO_DRAFT)
}

export async function createHeroSlide(input: SaveHeroSlideInput) {
    const actor = await getActorContext()
    const supabase = actor.supabase

    if (!input.title.trim()) {
        throw new Error("Slide title is required.")
    }

    if (!input.mediaUrl.trim() || !input.mediaPublicId.trim()) {
        throw new Error("Upload slide media before saving.")
    }

    const payload = {
        body_text: nullIfEmpty(input.bodyText),
        button_text: nullIfEmpty(input.buttonText),
        button_url: nullIfEmpty(input.buttonUrl),
        created_by: actor.user.id,
        display_duration_seconds: normalizeDisplayDurationSeconds(input.displayDurationSeconds),
        eyebrow_text: nullIfEmpty(input.eyebrowText),
        highlight_text: nullIfEmpty(input.highlightText),
        is_active: input.isActive,
        marketing_mode: normalizeMarketingMode(input.marketingMode),
        media_public_id: input.mediaPublicId.trim(),
        media_type: normalizeMediaType(input.mediaType),
        media_url: input.mediaUrl.trim(),
        placement: "storefront",
        sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
        title: input.title.trim(),
        updated_by: actor.user.id,
    }

    const { data: createdSlide, error } = await supabase
        .from("hero_carousel_slides")
        .insert(payload)
        .select("id")
        .single()

    if (error) {
        throw new Error(error.message)
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "create_storefront_hero_slide",
        entityId: createdSlide.id,
        entityType: "hero_carousel_slide",
        metadata: payload,
    })

    revalidateHeroPaths()
    return { success: true }
}

export async function updateHeroSlide(slideId: string, input: SaveHeroSlideInput) {
    const actor = await getActorContext()
    const supabase = actor.supabase
    const { data: existingSlide, error: existingError } = await supabase
        .from("hero_carousel_slides")
        .select("*")
        .eq("id", slideId)
        .eq("placement", "storefront")
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    if (!input.title.trim()) {
        throw new Error("Slide title is required.")
    }

    if (!input.mediaUrl.trim() || !input.mediaPublicId.trim()) {
        throw new Error("Upload slide media before saving.")
    }

    const payload = {
        body_text: nullIfEmpty(input.bodyText),
        button_text: nullIfEmpty(input.buttonText),
        button_url: nullIfEmpty(input.buttonUrl),
        display_duration_seconds: normalizeDisplayDurationSeconds(input.displayDurationSeconds),
        eyebrow_text: nullIfEmpty(input.eyebrowText),
        highlight_text: nullIfEmpty(input.highlightText),
        is_active: input.isActive,
        marketing_mode: normalizeMarketingMode(input.marketingMode),
        media_public_id: input.mediaPublicId.trim(),
        media_type: normalizeMediaType(input.mediaType),
        media_url: input.mediaUrl.trim(),
        placement: "storefront",
        sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
        title: input.title.trim(),
        updated_by: actor.user.id,
    }

    const { error } = await supabase
        .from("hero_carousel_slides")
        .update(payload)
        .eq("id", slideId)
        .eq("placement", "storefront")

    if (error) {
        throw new Error(error.message)
    }

    try {
        if (existingSlide.media_public_id !== payload.media_public_id) {
            await deleteCookOffCloudinaryAsset(existingSlide.media_public_id, normalizeMediaType(existingSlide.media_type))
        }
    } catch {
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "update_storefront_hero_slide",
        entityId: slideId,
        entityType: "hero_carousel_slide",
        metadata: payload,
    })

    revalidateHeroPaths()
    return { success: true }
}

export async function deleteHeroSlide(slideId: string) {
    const actor = await getActorContext()
    const supabase = actor.supabase
    const { data: existingSlide, error: existingError } = await supabase
        .from("hero_carousel_slides")
        .select("*")
        .eq("id", slideId)
        .eq("placement", "storefront")
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const { error } = await supabase
        .from("hero_carousel_slides")
        .delete()
        .eq("id", slideId)
        .eq("placement", "storefront")

    if (error) {
        throw new Error(error.message)
    }

    try {
        await deleteCookOffCloudinaryAsset(existingSlide.media_public_id, normalizeMediaType(existingSlide.media_type))
    } catch {
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "delete_storefront_hero_slide",
        entityId: slideId,
        entityType: "hero_carousel_slide",
        metadata: {
            title: existingSlide.title,
        },
    })

    revalidateHeroPaths()
    return { success: true }
}
