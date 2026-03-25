"use server"

import { revalidatePath } from "next/cache"
import { deleteDiscountBundleCloudinaryAsset } from "@/app/actions/discountBundleMediaActions"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { nairaToKobo } from "@/lib/money"
import {
    calculateBundleSavingsPercent,
    formatBundleRedemptionRate,
    normalizeDiscountBundleFeaturePoints,
} from "@/lib/discountBundles"
import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert } from "@/types/database.types"

type DiscountBundleRow = Tables<"discount_bundles">
type DiscountBundleItemRow = Tables<"discount_bundle_items">
type DiscountBundlePageRow = Tables<"discount_bundle_page_content">
type ProductRow = Tables<"products">

interface BundleProductSnapshot {
    id: string
    image_url: string | null
    merchant_id: string
    name: string
    price: number
    stock_level: number | null
}

interface DiscountBundleItemInput {
    productId: string
    quantity: number
}

interface SaveDiscountBundleInput {
    badgeText?: string
    buttonText?: string
    campaignEndsAt?: string | null
    campaignStartsAt?: string | null
    cardMediaPublicId: string
    cardMediaType: "image" | "video"
    cardMediaUrl: string
    description?: string
    discountMode: "percent" | "fixed_price"
    discountPercent?: number | null
    fixedPriceNaira?: number | null
    isFeatured: boolean
    items: DiscountBundleItemInput[]
    slug: string
    sortOrder: number
    status: "draft" | "active" | "archived"
    summary?: string
    title: string
}

interface SaveDiscountBundlePageInput {
    closingBody?: string
    closingCtaText?: string
    closingCtaUrl?: string
    closingTitle?: string
    description?: string
    eyebrowText?: string
    featurePoints: Array<{ body: string; title: string }>
    heroMediaPublicId?: string
    heroMediaType: "image" | "video"
    heroMediaUrl?: string
    highlightText?: string
    primaryCtaText?: string
    primaryCtaUrl?: string
    secondaryDescription?: string
    secondaryHeading?: string
    title?: string
}

interface DiscountBundleSalesSnapshot {
    createdAt: string | null
    orderId: string
    paymentStatus: string
    pricePerUnit: number
    quantity: number
    revenueKobo: number
    status: string | null
}

export interface DiscountBundleAdminProductOption {
    id: string
    imageUrl: string | null
    merchantId: string
    name: string
    priceKobo: number
    stockLevel: number | null
}

export interface DiscountBundleAdminBundleItem {
    productId: string
    productImageUrl: string | null
    productName: string
    productPriceKobo: number
    productStockLevel: number | null
    quantity: number
    sortOrder: number
}

export interface DiscountBundleAdminBundle {
    badgeText: string | null
    bundlePriceKobo: number
    buttonText: string
    campaignEndsAt: string | null
    campaignStartsAt: string | null
    cardMediaPublicId: string
    cardMediaType: "image" | "video"
    cardMediaUrl: string
    compareAtPriceKobo: number
    currentStock: number
    description: string | null
    discountMode: "percent" | "fixed_price"
    discountPercent: number | null
    fixedPriceKobo: number | null
    id: string
    isFeatured: boolean
    items: DiscountBundleAdminBundleItem[]
    merchantId: string
    orderCount: number
    productId: string
    quantitySold: number
    redemptionRate: number
    revenueKobo: number
    savingsPercent: number
    slug: string
    sortOrder: number
    status: string
    summary: string | null
    title: string
}

export interface DiscountBundleAdminPageContent {
    closingBody: string | null
    closingCtaText: string
    closingCtaUrl: string
    closingTitle: string
    description: string | null
    eyebrowText: string
    featurePoints: Array<{ body: string; title: string }>
    heroMediaPublicId: string | null
    heroMediaType: "image" | "video"
    heroMediaUrl: string | null
    highlightText: string | null
    primaryCtaText: string
    primaryCtaUrl: string
    secondaryDescription: string | null
    secondaryHeading: string
    title: string
}

export interface DiscountBundlesAdminDashboard {
    bundles: DiscountBundleAdminBundle[]
    pageContent: DiscountBundleAdminPageContent
    productCatalog: DiscountBundleAdminProductOption[]
    stats: {
        activeBundles: number
        featuredBundles: number
        totalBundles: number
        totalRevenueKobo: number
        totalUnitsSold: number
    }
}

interface DiscountBundleWithProductRow extends DiscountBundleRow {
    product?: BundleProductSnapshot | null
}

interface DiscountBundleItemWithProductRow extends DiscountBundleItemRow {
    product?: BundleProductSnapshot | null
}

interface DiscountBundleSaleRow {
    order_id: string
    orders?: {
        created_at: string | null
        payment_status: string
        status: string | null
    } | null
    price_per_unit: number
    product_id: string
    quantity: number
    total_price: number | null
}

const PAGE_SLUG = "home-essential-bundles"

function nullIfEmpty(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : null
}

function normalizeSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
}

async function requireAdmin() {
    return requireAdminRouteAccess("discount_bundles")
}

function revalidateDiscountBundlePaths() {
    revalidatePath("/")
    revalidatePath("/retail")
    revalidatePath("/wholesale")
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/discount-bundles")
    revalidatePath("/discount-bundles")
}

function ensureBundleStatus(value: string) {
    if (!["draft", "active", "archived"].includes(value)) {
        throw new Error("Invalid bundle status.")
    }

    return value as "draft" | "active" | "archived"
}

function ensureDiscountMode(value: string) {
    if (!["percent", "fixed_price"].includes(value)) {
        throw new Error("Invalid bundle discount mode.")
    }

    return value as "percent" | "fixed_price"
}

async function loadBundleProductSnapshots(supabase: Awaited<ReturnType<typeof createClient>>, productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds.filter(Boolean))]

    if (uniqueProductIds.length === 0) {
        return []
    }

    const { data, error } = await supabase
        .from("products")
        .select("id, merchant_id, name, price, stock_level, image_url, status")
        .in("id", uniqueProductIds)

    if (error) {
        throw new Error(error.message)
    }

    return (data ?? []) as Array<BundleProductSnapshot & { status: string | null }>
}

function buildBundleItems(
    items: DiscountBundleItemWithProductRow[],
    bundleId: string
): DiscountBundleAdminBundleItem[] {
    return items
        .filter((item) => item.bundle_id === bundleId && item.product)
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((item) => ({
            productId: item.product_id,
            productImageUrl: item.product?.image_url ?? null,
            productName: item.product?.name ?? "Unknown product",
            productPriceKobo: item.product?.price ?? 0,
            productStockLevel: item.product?.stock_level ?? null,
            quantity: item.quantity,
            sortOrder: item.sort_order,
        }))
}

function buildBundleSalesMap(rows: DiscountBundleSaleRow[]) {
    const salesByProductId = new Map<string, DiscountBundleSalesSnapshot[]>()

    rows.forEach((row) => {
        if (!row.orders || row.orders.payment_status !== "paid" || row.orders.status === "refunded") {
            return
        }

        const existing = salesByProductId.get(row.product_id) ?? []
        existing.push({
            createdAt: row.orders.created_at,
            orderId: row.order_id,
            paymentStatus: row.orders.payment_status,
            pricePerUnit: row.price_per_unit,
            quantity: row.quantity,
            revenueKobo: row.total_price ?? row.price_per_unit * row.quantity,
            status: row.orders.status,
        })
        salesByProductId.set(row.product_id, existing)
    })

    return salesByProductId
}

function mapPageContent(row: DiscountBundlePageRow | null): DiscountBundleAdminPageContent {
    return {
        closingBody: row?.closing_body ?? null,
        closingCtaText: row?.closing_cta_text ?? "View all bundles",
        closingCtaUrl: row?.closing_cta_url ?? "/discount-bundles",
        closingTitle: row?.closing_title ?? "Ready to start saving?",
        description: row?.description ?? null,
        eyebrowText: row?.eyebrow_text ?? "Save more with our",
        featurePoints: normalizeDiscountBundleFeaturePoints(row?.feature_points),
        heroMediaPublicId: row?.hero_media_public_id ?? null,
        heroMediaType: row?.hero_media_type === "video" ? "video" : "image",
        heroMediaUrl: row?.hero_media_url ?? null,
        highlightText: row?.highlight_text ?? null,
        primaryCtaText: row?.primary_cta_text ?? "View all bundles",
        primaryCtaUrl: row?.primary_cta_url ?? "/discount-bundles",
        secondaryDescription: row?.secondary_description ?? null,
        secondaryHeading: row?.secondary_heading ?? "Most Popular Bundles",
        title: row?.title ?? "Home Essential Bundles",
    }
}

export async function getDiscountBundlesAdminData(): Promise<DiscountBundlesAdminDashboard> {
    const { supabase } = await requireAdmin()

    const [{ data: pageContentData, error: pageContentError }, { data: bundlesData, error: bundlesError }, { data: bundleItemsData, error: bundleItemsError }, { data: productsData, error: productsError }] = await Promise.all([
        supabase
            .from("discount_bundle_page_content")
            .select("*")
            .eq("slug", PAGE_SLUG)
            .maybeSingle(),
        supabase
            .from("discount_bundles")
            .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false }),
        supabase
            .from("discount_bundle_items")
            .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        supabase
            .from("products")
            .select("id, merchant_id, name, price, stock_level, image_url, status")
            .eq("status", "approved")
            .order("name", { ascending: true }),
    ])

    if (pageContentError) throw new Error(pageContentError.message)
    if (bundlesError) throw new Error(bundlesError.message)
    if (bundleItemsError) throw new Error(bundleItemsError.message)
    if (productsError) throw new Error(productsError.message)

    const bundles = (bundlesData ?? []) as DiscountBundleWithProductRow[]
    const bundleItems = (bundleItemsData ?? []) as DiscountBundleItemWithProductRow[]
    const bundleProductIds = bundles.map((bundle) => bundle.product_id)

    const { data: salesRows, error: salesError } = bundleProductIds.length
        ? await supabase
            .from("order_items")
            .select("order_id, product_id, quantity, price_per_unit, total_price, orders:order_id(created_at, payment_status, status)")
            .in("product_id", bundleProductIds)
        : { data: [], error: null }

    if (salesError) {
        throw new Error(salesError.message)
    }

    const salesByProductId = buildBundleSalesMap((salesRows ?? []) as DiscountBundleSaleRow[])
    const bundleProductIdSet = new Set(bundleProductIds)
    const productCatalog = ((productsData ?? []) as ProductRow[])
        .filter((product) => !bundleProductIdSet.has(product.id))
        .map((product) => ({
            id: product.id,
            imageUrl: product.image_url ?? null,
            merchantId: product.merchant_id,
            name: product.name,
            priceKobo: product.price,
            stockLevel: product.stock_level ?? null,
        }))

    const mappedBundles: DiscountBundleAdminBundle[] = bundles.map((bundle) => {
        const items = buildBundleItems(bundleItems, bundle.id)
        const sales = salesByProductId.get(bundle.product_id) ?? []
        const revenueKobo = sales.reduce((sum, item) => sum + item.revenueKobo, 0)
        const quantitySold = sales.reduce((sum, item) => sum + item.quantity, 0)
        const orderCount = new Set(sales.map((item) => item.orderId)).size
        const currentStock = bundle.product?.stock_level ?? 0

        return {
            badgeText: bundle.badge_text ?? null,
            bundlePriceKobo: bundle.bundle_price_kobo,
            buttonText: bundle.button_text,
            campaignEndsAt: bundle.campaign_ends_at ?? null,
            campaignStartsAt: bundle.campaign_starts_at ?? null,
            cardMediaPublicId: bundle.card_media_public_id,
            cardMediaType: bundle.card_media_type === "video" ? "video" : "image",
            cardMediaUrl: bundle.card_media_url,
            compareAtPriceKobo: bundle.compare_at_price_kobo,
            currentStock,
            description: bundle.description ?? null,
            discountMode: ensureDiscountMode(bundle.discount_mode),
            discountPercent: bundle.discount_percent ?? null,
            fixedPriceKobo: bundle.fixed_price_kobo ?? null,
            id: bundle.id,
            isFeatured: bundle.is_featured,
            items,
            merchantId: bundle.product?.merchant_id ?? "",
            orderCount,
            productId: bundle.product_id,
            quantitySold,
            redemptionRate: formatBundleRedemptionRate(quantitySold, currentStock),
            revenueKobo,
            savingsPercent: calculateBundleSavingsPercent(bundle.bundle_price_kobo, bundle.compare_at_price_kobo),
            slug: bundle.slug,
            sortOrder: bundle.sort_order,
            status: bundle.status,
            summary: bundle.summary ?? null,
            title: bundle.title,
        }
    })

    return {
        bundles: mappedBundles,
        pageContent: mapPageContent((pageContentData ?? null) as DiscountBundlePageRow | null),
        productCatalog,
        stats: {
            activeBundles: mappedBundles.filter((bundle) => bundle.status === "active").length,
            featuredBundles: mappedBundles.filter((bundle) => bundle.isFeatured).length,
            totalBundles: mappedBundles.length,
            totalRevenueKobo: mappedBundles.reduce((sum, bundle) => sum + bundle.revenueKobo, 0),
            totalUnitsSold: mappedBundles.reduce((sum, bundle) => sum + bundle.quantitySold, 0),
        },
    }
}

async function persistBundleItems(
    supabase: Awaited<ReturnType<typeof createClient>>,
    bundleId: string,
    items: DiscountBundleItemInput[]
) {
    if (items.length === 0) {
        throw new Error("Add at least one product to the bundle.")
    }

    const payload = items.map((item, index) => ({
        bundle_id: bundleId,
        product_id: item.productId,
        quantity: item.quantity,
        sort_order: index,
    }))

    const { error } = await supabase.from("discount_bundle_items").insert(payload)

    if (error) {
        throw new Error(error.message)
    }
}

async function validateBundleItems(
    supabase: Awaited<ReturnType<typeof createClient>>,
    items: DiscountBundleItemInput[]
) {
    const normalizedItems = items
        .filter((item) => item.productId && item.quantity > 0)
        .map((item) => ({
            productId: item.productId,
            quantity: Math.floor(item.quantity),
        }))

    if (normalizedItems.length === 0) {
        throw new Error("Add at least one product to the bundle.")
    }

    const productRows = await loadBundleProductSnapshots(
        supabase,
        normalizedItems.map((item) => item.productId)
    )

    if (productRows.length !== new Set(normalizedItems.map((item) => item.productId)).size) {
        throw new Error("One or more selected products could not be found.")
    }

    if (productRows.some((product) => product.status !== "approved")) {
        throw new Error("Only approved products can be bundled.")
    }

    const merchantId = productRows[0]?.merchant_id ?? null

    if (!merchantId || productRows.some((product) => product.merchant_id !== merchantId)) {
        throw new Error("Bundle products must all belong to the same merchant.")
    }

    return {
        items: normalizedItems,
        merchantId,
    }
}

function buildBundleProductPayload(input: SaveDiscountBundleInput, merchantId: string): TablesInsert<"products"> {
    return {
        category: "specialty",
        description: nullIfEmpty(input.description),
        image_url: input.cardMediaUrl.trim(),
        images: input.cardMediaUrl.trim() ? [input.cardMediaUrl.trim()] : null,
        is_available: false,
        merchant_id: merchantId,
        name: input.title.trim(),
        price: 0,
        sales_type: "retail",
        status: "approved",
        stock_level: 0,
    } as unknown as TablesInsert<"products">
}

function buildBundleRowPayload(input: SaveDiscountBundleInput, userId: string, productId: string) {
    const discountMode = ensureDiscountMode(input.discountMode)
    const status = ensureBundleStatus(input.status)
    const fixedPriceNaira = Number(input.fixedPriceNaira ?? 0)

    if (!input.cardMediaUrl.trim() || !input.cardMediaPublicId.trim()) {
        throw new Error("Upload bundle media before saving.")
    }

    if (!input.title.trim()) {
        throw new Error("Bundle title is required.")
    }

    const slug = normalizeSlug(input.slug || input.title)

    if (!slug) {
        throw new Error("Bundle slug is required.")
    }

    if (discountMode === "percent") {
        const percent = Number(input.discountPercent ?? 0)

        if (!Number.isFinite(percent) || percent < 1 || percent > 95) {
            throw new Error("Percentage discounts must be between 1 and 95.")
        }
    }

    if (discountMode === "fixed_price") {
        if (!Number.isFinite(fixedPriceNaira) || fixedPriceNaira <= 0) {
            throw new Error("Enter a valid fixed bundle price.")
        }
    }

    return {
        badge_text: nullIfEmpty(input.badgeText),
        button_text: nullIfEmpty(input.buttonText) ?? "View bundle",
        campaign_ends_at: nullIfEmpty(input.campaignEndsAt),
        campaign_starts_at: nullIfEmpty(input.campaignStartsAt),
        card_media_public_id: input.cardMediaPublicId.trim(),
        card_media_type: input.cardMediaType,
        card_media_url: input.cardMediaUrl.trim(),
        description: nullIfEmpty(input.description),
        discount_mode: discountMode,
        discount_percent: discountMode === "percent" ? Math.round(Number(input.discountPercent ?? 0)) : null,
        fixed_price_kobo: discountMode === "fixed_price" ? nairaToKobo(fixedPriceNaira) : null,
        is_featured: input.isFeatured,
        product_id: productId,
        slug,
        sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
        status,
        summary: nullIfEmpty(input.summary),
        title: input.title.trim(),
        updated_by: userId,
    }
}

export async function saveDiscountBundlePageContent(input: SaveDiscountBundlePageInput) {
    const { supabase, user } = await requireAdmin()
    const { data: existingRow, error: existingError } = await supabase
        .from("discount_bundle_page_content")
        .select("hero_media_public_id, hero_media_type")
        .eq("slug", PAGE_SLUG)
        .single()

    if (existingError) {
        throw new Error(existingError.message)
    }

    const { error } = await supabase
        .from("discount_bundle_page_content")
        .upsert({
            slug: PAGE_SLUG,
            closing_body: nullIfEmpty(input.closingBody),
            closing_cta_text: nullIfEmpty(input.closingCtaText) ?? "View all bundles",
            closing_cta_url: nullIfEmpty(input.closingCtaUrl) ?? "/discount-bundles",
            closing_title: nullIfEmpty(input.closingTitle) ?? "Ready to start saving?",
            description: nullIfEmpty(input.description),
            eyebrow_text: nullIfEmpty(input.eyebrowText) ?? "Save more with our",
            feature_points: input.featurePoints,
            hero_media_public_id: nullIfEmpty(input.heroMediaPublicId),
            hero_media_type: input.heroMediaType,
            hero_media_url: nullIfEmpty(input.heroMediaUrl),
            highlight_text: nullIfEmpty(input.highlightText),
            primary_cta_text: nullIfEmpty(input.primaryCtaText) ?? "View all bundles",
            primary_cta_url: nullIfEmpty(input.primaryCtaUrl) ?? "/discount-bundles",
            secondary_description: nullIfEmpty(input.secondaryDescription),
            secondary_heading: nullIfEmpty(input.secondaryHeading) ?? "Most Popular Bundles",
            title: nullIfEmpty(input.title) ?? "Home Essential Bundles",
            updated_by: user.id,
        })

    if (error) {
        throw new Error(error.message)
    }

    if (
        existingRow?.hero_media_public_id &&
        existingRow.hero_media_public_id !== input.heroMediaPublicId &&
        existingRow.hero_media_type
    ) {
        await deleteDiscountBundleCloudinaryAsset(
            existingRow.hero_media_public_id,
            existingRow.hero_media_type === "video" ? "video" : "image"
        )
    }

    revalidateDiscountBundlePaths()
}

export async function createDiscountBundle(input: SaveDiscountBundleInput) {
    const { supabase, user } = await requireAdmin()
    const validated = await validateBundleItems(supabase, input.items)
    const productPayload = buildBundleProductPayload(input, validated.merchantId)

    const { data: product, error: productError } = await supabase
        .from("products")
        .insert(productPayload)
        .select("id")
        .single()

    if (productError || !product) {
        throw new Error(productError?.message ?? "Unable to create bundle product.")
    }

    const bundlePayload = {
        ...buildBundleRowPayload(input, user.id, product.id),
        created_by: user.id,
    }

    const { data: bundle, error: bundleError } = await supabase
        .from("discount_bundles")
        .insert(bundlePayload)
        .select("id")
        .single()

    if (bundleError || !bundle) {
        await supabase.from("products").delete().eq("id", product.id)
        throw new Error(bundleError?.message ?? "Unable to create discount bundle.")
    }

    try {
        await persistBundleItems(supabase, bundle.id, validated.items)
    } catch (error) {
        await supabase.from("discount_bundles").delete().eq("id", bundle.id)
        await supabase.from("products").delete().eq("id", product.id)
        throw error
    }

    revalidateDiscountBundlePaths()
}

export async function updateDiscountBundle(bundleId: string, input: SaveDiscountBundleInput) {
    const { supabase, user } = await requireAdmin()
    const validated = await validateBundleItems(supabase, input.items)

    const { data: existingBundle, error: existingBundleError } = await supabase
        .from("discount_bundles")
        .select("id, product_id, card_media_public_id, card_media_type")
        .eq("id", bundleId)
        .single()

    if (existingBundleError || !existingBundle) {
        throw new Error(existingBundleError?.message ?? "Discount bundle not found.")
    }

    const { error: productError } = await supabase
        .from("products")
        .update(buildBundleProductPayload(input, validated.merchantId))
        .eq("id", existingBundle.product_id)

    if (productError) {
        throw new Error(productError.message)
    }

    const { error: bundleError } = await supabase
        .from("discount_bundles")
        .update(buildBundleRowPayload(input, user.id, existingBundle.product_id))
        .eq("id", bundleId)

    if (bundleError) {
        throw new Error(bundleError.message)
    }

    const { error: deleteItemsError } = await supabase
        .from("discount_bundle_items")
        .delete()
        .eq("bundle_id", bundleId)

    if (deleteItemsError) {
        throw new Error(deleteItemsError.message)
    }

    await persistBundleItems(supabase, bundleId, validated.items)

    if (
        existingBundle.card_media_public_id &&
        existingBundle.card_media_public_id !== input.cardMediaPublicId &&
        existingBundle.card_media_type
    ) {
        await deleteDiscountBundleCloudinaryAsset(
            existingBundle.card_media_public_id,
            existingBundle.card_media_type === "video" ? "video" : "image"
        )
    }

    revalidateDiscountBundlePaths()
}

export async function deleteDiscountBundle(bundleId: string) {
    const { supabase } = await requireAdmin()
    const { data: bundle, error: bundleError } = await supabase
        .from("discount_bundles")
        .select("id, product_id, card_media_public_id, card_media_type")
        .eq("id", bundleId)
        .single()

    if (bundleError || !bundle) {
        throw new Error(bundleError?.message ?? "Discount bundle not found.")
    }

    const { data: existingOrders, error: existingOrdersError } = await supabase
        .from("order_items")
        .select("id")
        .eq("product_id", bundle.product_id)
        .limit(1)

    if (existingOrdersError) {
        throw new Error(existingOrdersError.message)
    }

    if ((existingOrders ?? []).length > 0) {
        const { error } = await supabase
            .from("discount_bundles")
            .update({ status: "archived" })
            .eq("id", bundleId)

        if (error) {
            throw new Error(error.message)
        }

        revalidateDiscountBundlePaths()
        return { archived: true }
    }

    const { error: deleteBundleError } = await supabase
        .from("discount_bundles")
        .delete()
        .eq("id", bundleId)

    if (deleteBundleError) {
        throw new Error(deleteBundleError.message)
    }

    const { error: deleteProductError } = await supabase
        .from("products")
        .delete()
        .eq("id", bundle.product_id)

    if (deleteProductError) {
        throw new Error(deleteProductError.message)
    }

    if (bundle.card_media_public_id) {
        await deleteDiscountBundleCloudinaryAsset(
            bundle.card_media_public_id,
            bundle.card_media_type === "video" ? "video" : "image"
        )
    }

    revalidateDiscountBundlePaths()
    return { archived: false }
}
