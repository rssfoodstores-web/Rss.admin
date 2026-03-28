export const AD_PLACEMENTS = [
    { value: "home_inline", label: "Home page" },
    { value: "retail_inline", label: "Retail page" },
    { value: "wholesale_inline", label: "Wholesale page" },
    { value: "discount_bundles_inline", label: "Discount bundles" },
    { value: "contact_inline", label: "Contact page" },
    { value: "account_dashboard", label: "Account dashboard" },
] as const

export type AdPlacement = (typeof AD_PLACEMENTS)[number]["value"]
export type AdMediaType = "image" | "video"

export function getAdPlacementLabel(placement: AdPlacement | string) {
    return AD_PLACEMENTS.find((entry) => entry.value === placement)?.label ?? placement
}
