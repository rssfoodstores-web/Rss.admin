"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    ImageIcon,
    Loader2,
    MonitorPlay,
    RotateCcw,
    Save,
    Sparkles,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { createAdminCookOffUploadSignature } from "@/app/actions/cookOffMediaActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { uploadSignedCloudinaryAsset } from "@/lib/cloudinaryMediaUpload"
import {
    type StorefrontHeroDefaultDraft,
    DEFAULT_STOREFRONT_HERO_DRAFT,
    isManagedStorefrontHeroMarketingMode,
    resolveStorefrontHeroDestination,
} from "@/lib/storefront-hero"
import type { Tables } from "@/types/database.types"
import {
    createHeroSlide,
    deleteHeroSlide,
    resetStorefrontHeroDefaultSlide,
    type StorefrontHeroAdminDashboard,
    updateHeroSlide,
    updateStorefrontHeroDefaultSlide,
} from "./actions"

type HeroSlideRow = Tables<"hero_carousel_slides">

interface HeroSlideFormState extends StorefrontHeroDefaultDraft {
    displayDurationSeconds: number
    isActive: boolean
    sortOrder: number
}

function buildSlideForm(slide?: HeroSlideRow | null): HeroSlideFormState {
    return {
        bodyText: slide?.body_text ?? "",
        buttonText: slide?.button_text ?? "",
        buttonUrl: slide?.button_url ?? "",
        displayDurationSeconds: slide?.display_duration_seconds ?? 7,
        eyebrowText: slide?.eyebrow_text ?? "",
        highlightText: slide?.highlight_text ?? "",
        isActive: slide?.is_active ?? true,
        marketingMode: slide?.marketing_mode ?? "standard",
        mediaPublicId: slide?.media_public_id ?? "",
        mediaType: slide?.media_type === "video" ? "video" : "image",
        mediaUrl: slide?.media_url ?? "",
        sortOrder: slide?.sort_order ?? 0,
        title: slide?.title ?? "",
    }
}

function buildDefaultForm(draft?: StorefrontHeroDefaultDraft | null): StorefrontHeroDefaultDraft {
    return {
        bodyText: draft?.bodyText ?? DEFAULT_STOREFRONT_HERO_DRAFT.bodyText,
        buttonText: draft?.buttonText ?? DEFAULT_STOREFRONT_HERO_DRAFT.buttonText,
        buttonUrl: draft?.buttonUrl ?? DEFAULT_STOREFRONT_HERO_DRAFT.buttonUrl,
        eyebrowText: draft?.eyebrowText ?? DEFAULT_STOREFRONT_HERO_DRAFT.eyebrowText,
        highlightText: draft?.highlightText ?? DEFAULT_STOREFRONT_HERO_DRAFT.highlightText,
        marketingMode: draft?.marketingMode ?? DEFAULT_STOREFRONT_HERO_DRAFT.marketingMode,
        mediaPublicId: draft?.mediaPublicId ?? DEFAULT_STOREFRONT_HERO_DRAFT.mediaPublicId,
        mediaType: draft?.mediaType ?? DEFAULT_STOREFRONT_HERO_DRAFT.mediaType,
        mediaUrl: draft?.mediaUrl ?? DEFAULT_STOREFRONT_HERO_DRAFT.mediaUrl,
        title: draft?.title ?? DEFAULT_STOREFRONT_HERO_DRAFT.title,
    }
}

function getMarketingModeHelper(marketingMode: string) {
    if (marketingMode === "cook_off") {
        return "This CTA always opens the live Cook-Off page at /cook-off."
    }

    if (marketingMode === "discount_bundles") {
        return "This CTA always opens the live discount bundles page at /discount-bundles."
    }

    return "Standard slides use the custom button URL you enter below."
}

export function HeroSectionAdminClient({ initialData }: { initialData: StorefrontHeroAdminDashboard }) {
    const router = useRouter()
    const [editingSlideId, setEditingSlideId] = useState<string | null>(initialData.slides[0]?.id ?? null)
    const [slideForm, setSlideForm] = useState<HeroSlideFormState>(() => buildSlideForm(initialData.slides[0] ?? null))
    const [defaultForm, setDefaultForm] = useState<StorefrontHeroDefaultDraft>(() => buildDefaultForm(initialData.defaultSlide))
    const [savingDefault, setSavingDefault] = useState(false)
    const [resettingDefault, setResettingDefault] = useState(false)
    const [savingSlide, setSavingSlide] = useState(false)
    const defaultDestination = resolveStorefrontHeroDestination(defaultForm.marketingMode, defaultForm.buttonUrl)
    const defaultUsesManagedDestination = isManagedStorefrontHeroMarketingMode(defaultForm.marketingMode)
    const slideDestination = resolveStorefrontHeroDestination(slideForm.marketingMode, slideForm.buttonUrl)
    const slideUsesManagedDestination = isManagedStorefrontHeroMarketingMode(slideForm.marketingMode)

    async function uploadHeroAsset(file: File, mediaType: "image" | "video") {
        return uploadSignedCloudinaryAsset(
            file,
            (fileName, resourceType) => createAdminCookOffUploadSignature(fileName, resourceType, "hero-slide"),
            mediaType
        )
    }

    const selectSlide = (slide: HeroSlideRow | null) => {
        setEditingSlideId(slide?.id ?? null)
        setSlideForm(buildSlideForm(slide))
    }

    async function handleDefaultMediaUpload(file: File) {
        try {
            const asset = await uploadHeroAsset(file, defaultForm.mediaType)
            setDefaultForm((current) => ({
                ...current,
                mediaPublicId: asset.publicId,
                mediaUrl: asset.secureUrl,
            }))
            toast.success("Default slide media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload default slide media.")
        }
    }

    async function handleSlideMediaUpload(file: File) {
        try {
            const asset = await uploadHeroAsset(file, slideForm.mediaType)
            setSlideForm((current) => ({
                ...current,
                mediaPublicId: asset.publicId,
                mediaUrl: asset.secureUrl,
            }))
            toast.success("Carousel slide media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload slide media.")
        }
    }

    async function saveDefaultSlide() {
        setSavingDefault(true)
        try {
            await updateStorefrontHeroDefaultSlide(defaultForm)
            toast.success("Default hero slide saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save default hero slide.")
        } finally {
            setSavingDefault(false)
        }
    }

    async function resetDefaultSlide() {
        setResettingDefault(true)
        try {
            await resetStorefrontHeroDefaultSlide()
            setDefaultForm(buildDefaultForm(DEFAULT_STOREFRONT_HERO_DRAFT))
            toast.success("Default hero slide reset.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to reset the default hero slide.")
        } finally {
            setResettingDefault(false)
        }
    }

    async function saveSlide() {
        setSavingSlide(true)
        try {
            if (editingSlideId) {
                await updateHeroSlide(editingSlideId, slideForm)
            } else {
                await createHeroSlide(slideForm)
            }
            toast.success("Hero carousel slide saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save hero carousel slide.")
        } finally {
            setSavingSlide(false)
        }
    }

    async function handleDeleteSlide(slideId: string) {
        const confirmed = window.confirm("Delete this hero carousel slide?")
        if (!confirmed) {
            return
        }

        try {
            await deleteHeroSlide(slideId)
            toast.success("Hero carousel slide deleted.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete hero carousel slide.")
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <Sparkles className="h-5 w-5 text-[#F58220]" />
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Storefront slides</p>
                    <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{initialData.stats.totalSlides}</p>
                </div>
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <MonitorPlay className="h-5 w-5 text-[#F58220]" />
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Active now</p>
                    <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{initialData.stats.activeSlides}</p>
                </div>
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <ImageIcon className="h-5 w-5 text-[#F58220]" />
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Serving mode</p>
                    <div className="mt-3">
                        <Badge className={initialData.stats.usesDefaultFallback ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700"}>
                            {initialData.stats.usesDefaultFallback ? "Default fallback live" : "Carousel live"}
                        </Badge>
                    </div>
                </div>
            </div>

            <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Default storefront hero</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            This slide shows when there are no active storefront carousel slides. It is the current fallback for the homepage, retail, and wholesale hero.
                        </p>
                    </div>
                    <Badge className={initialData.stats.usesDefaultFallback ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700"}>
                        {initialData.stats.usesDefaultFallback ? "Currently live" : "Standby fallback"}
                    </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Input value={defaultForm.title} onChange={(event) => setDefaultForm((current) => ({ ...current, title: event.target.value }))} placeholder="Slide title" className="h-11 rounded-2xl" />
                    <Input value={defaultForm.eyebrowText} onChange={(event) => setDefaultForm((current) => ({ ...current, eyebrowText: event.target.value }))} placeholder="Eyebrow text" className="h-11 rounded-2xl" />
                    <Input value={defaultForm.highlightText} onChange={(event) => setDefaultForm((current) => ({ ...current, highlightText: event.target.value }))} placeholder="Highlight text" className="h-11 rounded-2xl" />
                    <Input value={defaultForm.buttonText} onChange={(event) => setDefaultForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder="Button text" className="h-11 rounded-2xl" />
                    <Input
                        value={defaultUsesManagedDestination ? defaultDestination : defaultForm.buttonUrl}
                        onChange={(event) => setDefaultForm((current) => ({ ...current, buttonUrl: event.target.value }))}
                        placeholder="Button URL"
                        disabled={defaultUsesManagedDestination}
                        className="h-11 rounded-2xl"
                    />
                    <select value={defaultForm.marketingMode} onChange={(event) => setDefaultForm((current) => ({ ...current, marketingMode: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <option value="standard">Standard</option>
                        <option value="cook_off">Cook-Off</option>
                        <option value="discount_bundles">Discount Bundles</option>
                    </select>
                    <select value={defaultForm.mediaType} onChange={(event) => setDefaultForm((current) => ({ ...current, mediaType: event.target.value === "video" ? "video" : "image" }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                    <Input value={defaultForm.mediaUrl} onChange={(event) => setDefaultForm((current) => ({ ...current, mediaUrl: event.target.value }))} placeholder="Media URL" className="h-11 rounded-2xl" />
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getMarketingModeHelper(defaultForm.marketingMode)} Destination: <span className="font-semibold">{defaultDestination}</span>
                </p>

                <Textarea value={defaultForm.bodyText} onChange={(event) => setDefaultForm((current) => ({ ...current, bodyText: event.target.value }))} placeholder="Slide body text" className="min-h-24 rounded-2xl" />
                <input type="file" accept={defaultForm.mediaType === "video" ? "video/*" : "image/*"} onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleDefaultMediaUpload(file)
                }} className="block w-full text-sm text-gray-500" />
                {defaultForm.mediaUrl ? <p className="text-xs text-gray-400 break-all">{defaultForm.mediaUrl}</p> : null}

                <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={() => void saveDefaultSlide()} disabled={savingDefault} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        {savingDefault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save default slide
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void resetDefaultSlide()} disabled={resettingDefault} className="rounded-full">
                        {resettingDefault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                        Reset to system default
                    </Button>
                </div>
            </section>

            <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Live storefront carousel</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            These slides override the default fallback whenever at least one active slide exists.
                        </p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => selectSlide(null)}>New slide</Button>
                </div>

                <div className="grid gap-3">
                    {initialData.slides.length === 0 ? (
                        <div className="rounded-[1.75rem] border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-gray-400">
                            No live storefront slides yet. The editable default hero is currently serving.
                        </div>
                    ) : (
                        initialData.slides.map((slide) => (
                            <div key={slide.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900 dark:text-white">{slide.title}</p>
                                        <Badge>{slide.marketing_mode}</Badge>
                                        {slide.is_active ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge> : <Badge className="border-slate-200 bg-slate-50 text-slate-700">Inactive</Badge>}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Order {slide.sort_order} - {slide.media_type} - {slide.display_duration_seconds}s</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="rounded-full" onClick={() => selectSlide(slide)}>Edit</Button>
                                    <Button type="button" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteSlide(slide.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Input value={slideForm.title} onChange={(event) => setSlideForm((current) => ({ ...current, title: event.target.value }))} placeholder="Slide title" className="h-11 rounded-2xl" />
                    <Input value={slideForm.eyebrowText} onChange={(event) => setSlideForm((current) => ({ ...current, eyebrowText: event.target.value }))} placeholder="Eyebrow text" className="h-11 rounded-2xl" />
                    <Input value={slideForm.highlightText} onChange={(event) => setSlideForm((current) => ({ ...current, highlightText: event.target.value }))} placeholder="Highlight text" className="h-11 rounded-2xl" />
                    <Input value={slideForm.buttonText} onChange={(event) => setSlideForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder="Button text" className="h-11 rounded-2xl" />
                    <Input
                        value={slideUsesManagedDestination ? slideDestination : slideForm.buttonUrl}
                        onChange={(event) => setSlideForm((current) => ({ ...current, buttonUrl: event.target.value }))}
                        placeholder="Button URL"
                        disabled={slideUsesManagedDestination}
                        className="h-11 rounded-2xl"
                    />
                    <Input type="number" value={slideForm.sortOrder} onChange={(event) => setSlideForm((current) => ({ ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} placeholder="Sort order" className="h-11 rounded-2xl" />
                    <Input
                        type="number"
                        min={2}
                        max={60}
                        value={slideForm.displayDurationSeconds}
                        onChange={(event) => setSlideForm((current) => ({ ...current, displayDurationSeconds: Number.parseInt(event.target.value, 10) || 7 }))}
                        placeholder="Slide duration (seconds)"
                        className="h-11 rounded-2xl"
                    />
                    <select value={slideForm.marketingMode} onChange={(event) => setSlideForm((current) => ({ ...current, marketingMode: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <option value="standard">Standard</option>
                        <option value="cook_off">Cook-Off</option>
                        <option value="discount_bundles">Discount Bundles</option>
                    </select>
                    <select value={slideForm.mediaType} onChange={(event) => setSlideForm((current) => ({ ...current, mediaType: event.target.value === "video" ? "video" : "image" }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getMarketingModeHelper(slideForm.marketingMode)} Destination: <span className="font-semibold">{slideDestination}</span>
                </p>

                <Textarea value={slideForm.bodyText} onChange={(event) => setSlideForm((current) => ({ ...current, bodyText: event.target.value }))} placeholder="Slide body text" className="min-h-24 rounded-2xl" />
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                    <input type="checkbox" checked={slideForm.isActive} onChange={(event) => setSlideForm((current) => ({ ...current, isActive: event.target.checked }))} />
                    Slide is active
                </label>
                <input type="file" accept={slideForm.mediaType === "video" ? "video/*" : "image/*"} onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleSlideMediaUpload(file)
                }} className="block w-full text-sm text-gray-500" />
                {slideForm.mediaUrl ? <p className="text-xs text-gray-400 break-all">{slideForm.mediaUrl}</p> : null}

                <Button type="button" onClick={() => void saveSlide()} disabled={savingSlide} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                    {savingSlide ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save carousel slide
                </Button>
            </section>
        </div>
    )
}
