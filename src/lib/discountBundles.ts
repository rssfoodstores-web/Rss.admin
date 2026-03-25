import type { Json } from "@/types/database.types"

export interface DiscountBundleFeaturePoint {
    title: string
    body: string
}

export function normalizeDiscountBundleFeaturePoints(value: Json | null | undefined): DiscountBundleFeaturePoint[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value
        .map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return null
            }

            const normalizedEntry = entry as Record<string, Json | undefined>
            const title = typeof normalizedEntry.title === "string" ? normalizedEntry.title.trim() : ""
            const body = typeof normalizedEntry.body === "string" ? normalizedEntry.body.trim() : ""

            if (!title || !body) {
                return null
            }

            return { title, body }
        })
        .filter((entry): entry is DiscountBundleFeaturePoint => Boolean(entry))
}

export function featurePointsToEditorValue(points: DiscountBundleFeaturePoint[]) {
    return points.map((point) => `${point.title} | ${point.body}`).join("\n")
}

export function parseFeaturePointsEditorValue(value: string): DiscountBundleFeaturePoint[] {
    return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [titlePart, ...bodyParts] = line.split("|")
            const title = titlePart?.trim() ?? ""
            const body = bodyParts.join("|").trim()

            if (!title || !body) {
                return null
            }

            return { title, body }
        })
        .filter((entry): entry is DiscountBundleFeaturePoint => Boolean(entry))
}

export function calculateBundleSavingsPercent(bundlePriceKobo: number, compareAtPriceKobo: number) {
    if (compareAtPriceKobo <= 0 || bundlePriceKobo >= compareAtPriceKobo) {
        return 0
    }

    return Math.round(((compareAtPriceKobo - bundlePriceKobo) / compareAtPriceKobo) * 100)
}

export function formatBundleRedemptionRate(quantitySold: number, currentStock: number) {
    const denominator = quantitySold + Math.max(currentStock, 0)

    if (denominator <= 0) {
        return 0
    }

    return Math.round((quantitySold / denominator) * 100)
}
