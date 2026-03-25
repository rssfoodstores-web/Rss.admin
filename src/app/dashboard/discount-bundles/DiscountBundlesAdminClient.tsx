"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, Loader2, Plus, Save, Sparkles, Trash2, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { createAdminDiscountBundleUploadSignature } from "@/app/actions/discountBundleMediaActions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { featurePointsToEditorValue, parseFeaturePointsEditorValue } from "@/lib/discountBundles"
import { formatKobo, koboToNaira } from "@/lib/money"
import { uploadSignedCloudinaryAsset } from "@/lib/cloudinaryMediaUpload"
import { cn } from "@/lib/utils"
import type {
    DiscountBundleAdminBundle,
    DiscountBundleAdminPageContent,
    DiscountBundleAdminProductOption,
    DiscountBundlesAdminDashboard,
} from "./actions"
import {
    createDiscountBundle,
    deleteDiscountBundle,
    saveDiscountBundlePageContent,
    updateDiscountBundle,
} from "./actions"

interface BundleFormState {
    badgeText: string
    buttonText: string
    campaignEndsAt: string
    campaignStartsAt: string
    cardMediaPublicId: string
    cardMediaType: "image" | "video"
    cardMediaUrl: string
    description: string
    discountMode: "percent" | "fixed_price"
    discountPercent: string
    fixedPriceNaira: string
    isFeatured: boolean
    items: Array<{ productId: string; quantity: number }>
    slug: string
    sortOrder: number
    status: "draft" | "active" | "archived"
    summary: string
    title: string
}

interface PageFormState {
    closingBody: string
    closingCtaText: string
    closingCtaUrl: string
    closingTitle: string
    description: string
    eyebrowText: string
    featurePointsText: string
    heroMediaPublicId: string
    heroMediaType: "image" | "video"
    heroMediaUrl: string
    highlightText: string
    primaryCtaText: string
    primaryCtaUrl: string
    secondaryDescription: string
    secondaryHeading: string
    title: string
}

function toDateTimeLocal(value: string | null) {
    if (!value) {
        return ""
    }

    return new Date(value).toISOString().slice(0, 16)
}

function toIsoOrNull(value: string) {
    if (!value.trim()) {
        return null
    }

    return new Date(value).toISOString()
}

function buildBundleForm(bundle?: DiscountBundleAdminBundle | null): BundleFormState {
    return {
        badgeText: bundle?.badgeText ?? "",
        buttonText: bundle?.buttonText ?? "View bundle",
        campaignEndsAt: toDateTimeLocal(bundle?.campaignEndsAt ?? null),
        campaignStartsAt: toDateTimeLocal(bundle?.campaignStartsAt ?? null),
        cardMediaPublicId: bundle?.cardMediaPublicId ?? "",
        cardMediaType: bundle?.cardMediaType ?? "image",
        cardMediaUrl: bundle?.cardMediaUrl ?? "",
        description: bundle?.description ?? "",
        discountMode: bundle?.discountMode ?? "fixed_price",
        discountPercent: bundle?.discountPercent?.toString() ?? "",
        fixedPriceNaira: bundle?.fixedPriceKobo ? koboToNaira(bundle.fixedPriceKobo).toFixed(2) : "",
        isFeatured: bundle?.isFeatured ?? false,
        items: bundle?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) ?? [],
        slug: bundle?.slug ?? "",
        sortOrder: bundle?.sortOrder ?? 0,
        status: (bundle?.status as "draft" | "active" | "archived") ?? "draft",
        summary: bundle?.summary ?? "",
        title: bundle?.title ?? "",
    }
}

function buildPageForm(pageContent: DiscountBundleAdminPageContent): PageFormState {
    return {
        closingBody: pageContent.closingBody ?? "",
        closingCtaText: pageContent.closingCtaText,
        closingCtaUrl: pageContent.closingCtaUrl,
        closingTitle: pageContent.closingTitle,
        description: pageContent.description ?? "",
        eyebrowText: pageContent.eyebrowText,
        featurePointsText: featurePointsToEditorValue(pageContent.featurePoints),
        heroMediaPublicId: pageContent.heroMediaPublicId ?? "",
        heroMediaType: pageContent.heroMediaType,
        heroMediaUrl: pageContent.heroMediaUrl ?? "",
        highlightText: pageContent.highlightText ?? "",
        primaryCtaText: pageContent.primaryCtaText,
        primaryCtaUrl: pageContent.primaryCtaUrl,
        secondaryDescription: pageContent.secondaryDescription ?? "",
        secondaryHeading: pageContent.secondaryHeading,
        title: pageContent.title,
    }
}

function formatProductLabel(product: DiscountBundleAdminProductOption) {
    return `${product.name} - ${formatKobo(product.priceKobo)} - stock ${product.stockLevel ?? 0}`
}

export function DiscountBundlesAdminClient({ initialData }: { initialData: DiscountBundlesAdminDashboard }) {
    const router = useRouter()
    const [selectedBundleId, setSelectedBundleId] = useState<string | null>(initialData.bundles[0]?.id ?? null)
    const [bundleForm, setBundleForm] = useState(() => buildBundleForm(initialData.bundles[0] ?? null))
    const [pageForm, setPageForm] = useState(() => buildPageForm(initialData.pageContent))
    const [draftProductId, setDraftProductId] = useState(initialData.productCatalog[0]?.id ?? "")
    const [draftQuantity, setDraftQuantity] = useState("1")
    const [savingBundle, setSavingBundle] = useState(false)
    const [savingPage, setSavingPage] = useState(false)

    const selectedBundle = useMemo(
        () => initialData.bundles.find((bundle) => bundle.id === selectedBundleId) ?? null,
        [initialData.bundles, selectedBundleId]
    )

    const catalogById = useMemo(
        () => new Map(initialData.productCatalog.map((product) => [product.id, product])),
        [initialData.productCatalog]
    )

    function selectBundle(bundle: DiscountBundleAdminBundle | null) {
        setSelectedBundleId(bundle?.id ?? null)
        setBundleForm(buildBundleForm(bundle))
    }

    function addBundleItem() {
        if (!draftProductId) {
            toast.error("Choose a product to add.")
            return
        }

        const quantity = Math.max(1, Math.trunc(Number(draftQuantity || "1")))
        const product = catalogById.get(draftProductId)

        if (!product) {
            toast.error("Selected product is no longer available.")
            return
        }

        setBundleForm((current) => {
            const existingItem = current.items.find((item) => item.productId === draftProductId)

            if (existingItem) {
                return {
                    ...current,
                    items: current.items.map((item) =>
                        item.productId === draftProductId
                            ? { ...item, quantity: Math.max(1, quantity) }
                            : item
                    ),
                }
            }

            return {
                ...current,
                items: [...current.items, { productId: draftProductId, quantity }],
            }
        })
    }

    async function uploadBundleMedia(file: File, target: "bundle-card" | "page-hero", mediaType: "image" | "video") {
        const asset = await uploadSignedCloudinaryAsset(
            file,
            (fileName, resourceType) => createAdminDiscountBundleUploadSignature(fileName, resourceType, target),
            mediaType
        )

        return {
            publicId: asset.publicId,
            url: asset.secureUrl,
        }
    }

    async function handleBundleMediaUpload(file: File) {
        try {
            const asset = await uploadBundleMedia(file, "bundle-card", bundleForm.cardMediaType)
            setBundleForm((current) => ({
                ...current,
                cardMediaPublicId: asset.publicId,
                cardMediaUrl: asset.url,
            }))
            toast.success("Bundle media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload bundle media.")
        }
    }

    async function handlePageMediaUpload(file: File) {
        try {
            const asset = await uploadBundleMedia(file, "page-hero", pageForm.heroMediaType)
            setPageForm((current) => ({
                ...current,
                heroMediaPublicId: asset.publicId,
                heroMediaUrl: asset.url,
            }))
            toast.success("Page hero media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload page media.")
        }
    }

    async function handleSavePage() {
        setSavingPage(true)
        try {
            await saveDiscountBundlePageContent({
                closingBody: pageForm.closingBody,
                closingCtaText: pageForm.closingCtaText,
                closingCtaUrl: pageForm.closingCtaUrl,
                closingTitle: pageForm.closingTitle,
                description: pageForm.description,
                eyebrowText: pageForm.eyebrowText,
                featurePoints: parseFeaturePointsEditorValue(pageForm.featurePointsText),
                heroMediaPublicId: pageForm.heroMediaPublicId,
                heroMediaType: pageForm.heroMediaType,
                heroMediaUrl: pageForm.heroMediaUrl,
                highlightText: pageForm.highlightText,
                primaryCtaText: pageForm.primaryCtaText,
                primaryCtaUrl: pageForm.primaryCtaUrl,
                secondaryDescription: pageForm.secondaryDescription,
                secondaryHeading: pageForm.secondaryHeading,
                title: pageForm.title,
            })
            toast.success("Discount page content saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save page content.")
        } finally {
            setSavingPage(false)
        }
    }

    async function handleSaveBundle() {
        setSavingBundle(true)
        try {
            const payload = {
                badgeText: bundleForm.badgeText,
                buttonText: bundleForm.buttonText,
                campaignEndsAt: toIsoOrNull(bundleForm.campaignEndsAt),
                campaignStartsAt: toIsoOrNull(bundleForm.campaignStartsAt),
                cardMediaPublicId: bundleForm.cardMediaPublicId,
                cardMediaType: bundleForm.cardMediaType,
                cardMediaUrl: bundleForm.cardMediaUrl,
                description: bundleForm.description,
                discountMode: bundleForm.discountMode,
                discountPercent: bundleForm.discountPercent ? Number(bundleForm.discountPercent) : null,
                fixedPriceNaira: bundleForm.fixedPriceNaira ? Number(bundleForm.fixedPriceNaira) : null,
                isFeatured: bundleForm.isFeatured,
                items: bundleForm.items,
                slug: bundleForm.slug,
                sortOrder: bundleForm.sortOrder,
                status: bundleForm.status,
                summary: bundleForm.summary,
                title: bundleForm.title,
            }

            if (selectedBundleId) {
                await updateDiscountBundle(selectedBundleId, payload)
            } else {
                await createDiscountBundle(payload)
            }

            toast.success("Discount bundle saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save discount bundle.")
        } finally {
            setSavingBundle(false)
        }
    }

    async function handleDeleteBundle(bundleId: string) {
        const confirmed = window.confirm("Delete this bundle? Existing sold bundles will be archived instead.")
        if (!confirmed) {
            return
        }

        try {
            const result = await deleteDiscountBundle(bundleId)
            toast.success(result.archived ? "Bundle archived because it already has orders." : "Bundle deleted.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete bundle.")
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
                {[
                    { label: "Total bundles", value: initialData.stats.totalBundles, icon: Sparkles, tone: "text-[#F58220] bg-orange-50" },
                    { label: "Active bundles", value: initialData.stats.activeBundles, icon: TrendingUp, tone: "text-emerald-600 bg-emerald-50" },
                    { label: "Featured bundles", value: initialData.stats.featuredBundles, icon: Archive, tone: "text-violet-600 bg-violet-50" },
                    { label: "Bundle revenue", value: formatKobo(initialData.stats.totalRevenueKobo), icon: Save, tone: "text-blue-600 bg-blue-50" },
                ].map((card) => (
                    <div key={card.label} className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", card.tone, "dark:bg-zinc-800/80")}>
                            <card.icon className="h-5 w-5" />
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{card.label}</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Discount page content</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Edit the landing page hero, highlights, and closing call-to-action.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Input value={pageForm.eyebrowText} onChange={(event) => setPageForm((current) => ({ ...current, eyebrowText: event.target.value }))} placeholder="Eyebrow text" className="h-11 rounded-2xl" />
                        <Input value={pageForm.title} onChange={(event) => setPageForm((current) => ({ ...current, title: event.target.value }))} placeholder="Page title" className="h-11 rounded-2xl" />
                        <Input value={pageForm.highlightText} onChange={(event) => setPageForm((current) => ({ ...current, highlightText: event.target.value }))} placeholder="Highlight text" className="h-11 rounded-2xl" />
                        <Input value={pageForm.primaryCtaText} onChange={(event) => setPageForm((current) => ({ ...current, primaryCtaText: event.target.value }))} placeholder="Primary CTA text" className="h-11 rounded-2xl" />
                        <Input value={pageForm.primaryCtaUrl} onChange={(event) => setPageForm((current) => ({ ...current, primaryCtaUrl: event.target.value }))} placeholder="Primary CTA URL" className="h-11 rounded-2xl" />
                        <Input value={pageForm.secondaryHeading} onChange={(event) => setPageForm((current) => ({ ...current, secondaryHeading: event.target.value }))} placeholder="Secondary section heading" className="h-11 rounded-2xl" />
                        <Input value={pageForm.closingTitle} onChange={(event) => setPageForm((current) => ({ ...current, closingTitle: event.target.value }))} placeholder="Closing title" className="h-11 rounded-2xl" />
                        <Input value={pageForm.closingCtaText} onChange={(event) => setPageForm((current) => ({ ...current, closingCtaText: event.target.value }))} placeholder="Closing CTA text" className="h-11 rounded-2xl" />
                        <Input value={pageForm.closingCtaUrl} onChange={(event) => setPageForm((current) => ({ ...current, closingCtaUrl: event.target.value }))} placeholder="Closing CTA URL" className="h-11 rounded-2xl" />
                        <select value={pageForm.heroMediaType} onChange={(event) => setPageForm((current) => ({ ...current, heroMediaType: event.target.value as "image" | "video" }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="image">Hero image</option>
                            <option value="video">Hero video</option>
                        </select>
                    </div>

                    <Textarea value={pageForm.description} onChange={(event) => setPageForm((current) => ({ ...current, description: event.target.value }))} placeholder="Page description" className="min-h-24 rounded-2xl" />
                    <Textarea value={pageForm.secondaryDescription} onChange={(event) => setPageForm((current) => ({ ...current, secondaryDescription: event.target.value }))} placeholder="Secondary section description" className="min-h-20 rounded-2xl" />
                    <Textarea value={pageForm.closingBody} onChange={(event) => setPageForm((current) => ({ ...current, closingBody: event.target.value }))} placeholder="Closing body copy" className="min-h-24 rounded-2xl" />
                    <Textarea value={pageForm.featurePointsText} onChange={(event) => setPageForm((current) => ({ ...current, featurePointsText: event.target.value }))} placeholder="Feature points. Use one line per benefit: Title | Body" className="min-h-28 rounded-2xl" />
                    <input type="file" accept={pageForm.heroMediaType === "video" ? "video/*" : "image/*"} onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void handlePageMediaUpload(file)
                    }} className="block w-full text-sm text-gray-500" />
                    {pageForm.heroMediaUrl ? <p className="break-all text-xs text-gray-400">{pageForm.heroMediaUrl}</p> : null}
                    <Button type="button" onClick={() => void handleSavePage()} disabled={savingPage} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        {savingPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save page content
                    </Button>
                </section>

                <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bundle campaigns</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create discounted bundle SKUs, attach products, and control campaign windows.</p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => selectBundle(null)}>
                            New bundle
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        {initialData.bundles.map((bundle) => (
                            <div key={bundle.id} className={cn("rounded-[1.5rem] border p-4 transition", selectedBundleId === bundle.id ? "border-[#F58220] bg-orange-50 dark:bg-orange-950/10" : "border-gray-100 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-950/40")}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <button type="button" onClick={() => selectBundle(bundle)} className="text-left">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">{bundle.title}</p>
                                            <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:border-zinc-700 dark:text-zinc-300">
                                                {bundle.status}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            {formatKobo(bundle.bundlePriceKobo)} from {formatKobo(bundle.compareAtPriceKobo)} | {bundle.quantitySold} sold | stock {bundle.currentStock}
                                        </p>
                                    </button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" className="rounded-full" onClick={() => selectBundle(bundle)}>Edit</Button>
                                        <Button type="button" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteBundle(bundle.id)}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input value={bundleForm.title} onChange={(event) => setBundleForm((current) => ({ ...current, title: event.target.value }))} placeholder="Bundle title" className="h-11 rounded-2xl" />
                        <Input value={bundleForm.slug} onChange={(event) => setBundleForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Bundle slug" className="h-11 rounded-2xl" />
                        <Input value={bundleForm.badgeText} onChange={(event) => setBundleForm((current) => ({ ...current, badgeText: event.target.value }))} placeholder="Badge text" className="h-11 rounded-2xl" />
                        <Input value={bundleForm.buttonText} onChange={(event) => setBundleForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder="Button text" className="h-11 rounded-2xl" />
                        <Input type="number" value={bundleForm.sortOrder} onChange={(event) => setBundleForm((current) => ({ ...current, sortOrder: Number(event.target.value || "0") }))} placeholder="Sort order" className="h-11 rounded-2xl" />
                        <select value={bundleForm.status} onChange={(event) => setBundleForm((current) => ({ ...current, status: event.target.value as BundleFormState["status"] }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                        <select value={bundleForm.discountMode} onChange={(event) => setBundleForm((current) => ({ ...current, discountMode: event.target.value as BundleFormState["discountMode"] }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="fixed_price">Fixed price</option>
                            <option value="percent">Percentage discount</option>
                        </select>
                        {bundleForm.discountMode === "percent" ? (
                            <Input type="number" value={bundleForm.discountPercent} onChange={(event) => setBundleForm((current) => ({ ...current, discountPercent: event.target.value }))} placeholder="Discount percent" className="h-11 rounded-2xl" />
                        ) : (
                            <Input type="number" value={bundleForm.fixedPriceNaira} onChange={(event) => setBundleForm((current) => ({ ...current, fixedPriceNaira: event.target.value }))} placeholder="Fixed bundle price (NGN)" className="h-11 rounded-2xl" />
                        )}
                        <Input type="datetime-local" value={bundleForm.campaignStartsAt} onChange={(event) => setBundleForm((current) => ({ ...current, campaignStartsAt: event.target.value }))} className="h-11 rounded-2xl" />
                        <Input type="datetime-local" value={bundleForm.campaignEndsAt} onChange={(event) => setBundleForm((current) => ({ ...current, campaignEndsAt: event.target.value }))} className="h-11 rounded-2xl" />
                        <select value={bundleForm.cardMediaType} onChange={(event) => setBundleForm((current) => ({ ...current, cardMediaType: event.target.value as "image" | "video" }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="image">Card image</option>
                            <option value="video">Card video</option>
                        </select>
                        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                            <input type="checkbox" checked={bundleForm.isFeatured} onChange={(event) => setBundleForm((current) => ({ ...current, isFeatured: event.target.checked }))} />
                            Feature this bundle
                        </label>
                    </div>

                    <Textarea value={bundleForm.summary} onChange={(event) => setBundleForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Short bundle summary" className="min-h-20 rounded-2xl" />
                    <Textarea value={bundleForm.description} onChange={(event) => setBundleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Bundle description" className="min-h-24 rounded-2xl" />
                    <input type="file" accept={bundleForm.cardMediaType === "video" ? "video/*" : "image/*"} onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void handleBundleMediaUpload(file)
                    }} className="block w-full text-sm text-gray-500" />
                    {bundleForm.cardMediaUrl ? <p className="break-all text-xs text-gray-400">{bundleForm.cardMediaUrl}</p> : null}

                    <div className="rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[240px] flex-1">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Add product</label>
                                <select value={draftProductId} onChange={(event) => setDraftProductId(event.target.value)} className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                                    {initialData.productCatalog.map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {formatProductLabel(product)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-28">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Qty</label>
                                <Input type="number" min={1} value={draftQuantity} onChange={(event) => setDraftQuantity(event.target.value)} className="h-11 rounded-2xl" />
                            </div>
                            <Button type="button" variant="outline" className="rounded-full" onClick={addBundleItem}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add item
                            </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {bundleForm.items.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No products added yet.</p>
                            ) : (
                                bundleForm.items.map((item, index) => {
                                    const product = catalogById.get(item.productId)

                                    return (
                                        <div key={`${item.productId}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{product?.name ?? "Unknown product"}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {product ? formatKobo(product.priceKobo) : "-"} | stock {product?.stockLevel ?? 0}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Input type="number" min={1} value={item.quantity} onChange={(event) => {
                                                    const nextQuantity = Math.max(1, Math.trunc(Number(event.target.value || "1")))
                                                    setBundleForm((current) => ({
                                                        ...current,
                                                        items: current.items.map((currentItem, currentIndex) =>
                                                            currentIndex === index
                                                                ? { ...currentItem, quantity: nextQuantity }
                                                                : currentItem
                                                        ),
                                                    }))
                                                }} className="h-10 w-24 rounded-2xl" />
                                                <Button type="button" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => {
                                                    setBundleForm((current) => ({
                                                        ...current,
                                                        items: current.items.filter((_, currentIndex) => currentIndex !== index),
                                                    }))
                                                }}>
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {selectedBundle ? (
                        <div className="rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                            <p>Live metrics: {selectedBundle.orderCount} orders | {selectedBundle.quantitySold} bundles sold | {formatKobo(selectedBundle.revenueKobo)} revenue | {selectedBundle.redemptionRate}% redemption.</p>
                        </div>
                    ) : null}

                    <Button type="button" onClick={() => void handleSaveBundle()} disabled={savingBundle} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        {savingBundle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save bundle
                    </Button>
                </section>
            </div>
        </div>
    )
}
