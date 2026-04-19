export const STOREFRONT_HERO_DEFAULT_SETTING_KEY = "storefront_hero_default_slide" as const

const MANAGED_MARKETING_DESTINATIONS = {
    cook_off: "/cook-off",
    discount_bundles: "/discount-bundles",
} as const

export interface StorefrontHeroDefaultDraft {
    bodyText: string
    buttonText: string
    buttonUrl: string
    eyebrowText: string
    highlightText: string
    marketingMode: string
    mediaPublicId: string
    mediaType: "image" | "video"
    mediaUrl: string
    title: string
}

const MARKETING_MODES = new Set(["standard", "cook_off", "discount_bundles"])

export const DEFAULT_STOREFRONT_HERO_DRAFT: StorefrontHeroDefaultDraft = {
    bodyText: "Premium groceries, fresh produce, and household staples delivered with speed across Nigeria.",
    buttonText: "Shop now",
    buttonUrl: "/retail",
    eyebrowText: "Sale up to 48% off",
    highlightText: "Organic Food",
    marketingMode: "standard",
    mediaPublicId: "",
    mediaType: "image",
    mediaUrl: "/assets/hero-banner.png",
    title: "Fresh & Healthy",
}

function readString(record: Record<string, unknown>, key: string, fallback: string) {
    const value = record[key]
    return typeof value === "string" ? value : fallback
}

export function normalizeStorefrontHeroDefaultDraft(value: unknown): StorefrontHeroDefaultDraft {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return DEFAULT_STOREFRONT_HERO_DRAFT
    }

    const record = value as Record<string, unknown>
    const mediaType = record.media_type === "video" ? "video" : "image"
    const marketingMode = readString(record, "marketing_mode", DEFAULT_STOREFRONT_HERO_DRAFT.marketingMode)

    return {
        bodyText: readString(record, "body_text", DEFAULT_STOREFRONT_HERO_DRAFT.bodyText),
        buttonText: readString(record, "button_text", DEFAULT_STOREFRONT_HERO_DRAFT.buttonText),
        buttonUrl: readString(record, "button_url", DEFAULT_STOREFRONT_HERO_DRAFT.buttonUrl),
        eyebrowText: readString(record, "eyebrow_text", DEFAULT_STOREFRONT_HERO_DRAFT.eyebrowText),
        highlightText: readString(record, "highlight_text", DEFAULT_STOREFRONT_HERO_DRAFT.highlightText),
        marketingMode: MARKETING_MODES.has(marketingMode) ? marketingMode : DEFAULT_STOREFRONT_HERO_DRAFT.marketingMode,
        mediaPublicId: readString(record, "media_public_id", DEFAULT_STOREFRONT_HERO_DRAFT.mediaPublicId),
        mediaType,
        mediaUrl: readString(record, "media_url", DEFAULT_STOREFRONT_HERO_DRAFT.mediaUrl),
        title: readString(record, "title", DEFAULT_STOREFRONT_HERO_DRAFT.title),
    }
}

export function serializeStorefrontHeroDefaultDraft(draft: StorefrontHeroDefaultDraft) {
    const mediaUrl = draft.mediaUrl.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.mediaUrl
    const mediaPublicId = mediaUrl.startsWith("/assets/") ? "" : draft.mediaPublicId.trim()

    return {
        body_text: draft.bodyText.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.bodyText,
        button_text: draft.buttonText.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.buttonText,
        button_url: draft.buttonUrl.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.buttonUrl,
        eyebrow_text: draft.eyebrowText.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.eyebrowText,
        highlight_text: draft.highlightText.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.highlightText,
        marketing_mode: MARKETING_MODES.has(draft.marketingMode) ? draft.marketingMode : DEFAULT_STOREFRONT_HERO_DRAFT.marketingMode,
        media_public_id: mediaPublicId,
        media_type: draft.mediaType === "video" ? "video" : "image",
        media_url: mediaUrl,
        title: draft.title.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.title,
    }
}

export function isManagedStorefrontHeroMarketingMode(marketingMode: string) {
    return marketingMode === "cook_off" || marketingMode === "discount_bundles"
}

export function resolveStorefrontHeroDestination(marketingMode: string, buttonUrl: string) {
    if (marketingMode === "cook_off") {
        return MANAGED_MARKETING_DESTINATIONS.cook_off
    }

    if (marketingMode === "discount_bundles") {
        return MANAGED_MARKETING_DESTINATIONS.discount_bundles
    }

    return buttonUrl.trim() || DEFAULT_STOREFRONT_HERO_DRAFT.buttonUrl
}
