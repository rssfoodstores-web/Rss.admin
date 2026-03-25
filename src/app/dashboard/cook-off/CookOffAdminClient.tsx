"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Copy,
    Loader2,
    Save,
    Sparkles,
    Trash2,
    Trophy,
    Video,
} from "lucide-react"
import { toast } from "sonner"
import { createAdminCookOffUploadSignature } from "@/app/actions/cookOffMediaActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { uploadSignedCloudinaryAsset } from "@/lib/cloudinaryMediaUpload"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database.types"
import type { CookOffAdminDashboard, CookOffAdminEntryViewModel } from "./actions"
import {
    createCookOffSession,
    createHeroSlide,
    deleteHeroSlide,
    saveCookOffReview,
    updateCookOffSession,
    updateHeroSlide,
} from "./actions"

type HeroSlideRow = Tables<"hero_carousel_slides">
type CookOffSessionRow = Tables<"cook_off_sessions">

function buildSlideForm(slide?: HeroSlideRow | null) {
    return {
        bodyText: slide?.body_text ?? "",
        buttonText: slide?.button_text ?? "",
        buttonUrl: slide?.button_url ?? "",
        eyebrowText: slide?.eyebrow_text ?? "",
        highlightText: slide?.highlight_text ?? "",
        isActive: slide?.is_active ?? true,
        marketingMode: slide?.marketing_mode ?? "standard",
        mediaPublicId: slide?.media_public_id ?? "",
        mediaType: slide?.media_type ?? "image",
        mediaUrl: slide?.media_url ?? "",
        sortOrder: slide?.sort_order ?? 0,
        title: slide?.title ?? "",
    }
}

function buildSessionForm(session?: CookOffSessionRow | null) {
    return {
        ctaText: session?.cta_text ?? "Submit your entry",
        description: session?.description ?? "",
        heroMediaPublicId: session?.hero_media_public_id ?? "",
        heroMediaType: session?.hero_media_type ?? "image",
        heroMediaUrl: session?.hero_media_url ?? "",
        monthLabel: session?.month_label ?? "",
        prizes: session?.prizes ?? "",
        rules: session?.rules ?? "",
        slug: session?.slug ?? "",
        status: session?.status ?? "draft",
        summary: session?.summary ?? "",
        theme: session?.theme ?? "",
        title: session?.title ?? "",
    }
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

function copyText(value: string, label: string) {
    void navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
}

function ReviewCard({ entry }: { entry: CookOffAdminEntryViewModel }) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [status, setStatus] = useState<"approved" | "rejected">((entry.status === "rejected" ? "rejected" : "approved"))
    const [feedback, setFeedback] = useState(entry.adminFeedback ?? "")
    const [creativityScore, setCreativityScore] = useState(entry.adminCreativityScore?.toString() ?? "")
    const [presentationScore, setPresentationScore] = useState(entry.adminPresentationScore?.toString() ?? "")
    const [isFeatured, setIsFeatured] = useState(entry.isFeatured)
    const [winnerPosition, setWinnerPosition] = useState(entry.winnerPosition?.toString() ?? "")

    async function handleSave() {
        setSaving(true)
        try {
            await saveCookOffReview({
                adminCreativityScore: creativityScore ? Number.parseInt(creativityScore, 10) : null,
                adminFeedback: feedback,
                adminPresentationScore: presentationScore ? Number.parseInt(presentationScore, 10) : null,
                entryId: entry.id,
                isFeatured,
                status,
                winnerPosition: winnerPosition ? Number.parseInt(winnerPosition, 10) : null,
            })
            toast.success("Cook-Off review saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save review.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <article className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{entry.recipeName}</h3>
                        <Badge>{entry.status}</Badge>
                        {entry.winnerPosition ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Winner #{entry.winnerPosition}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {entry.submitterName} - {entry.submitterEmail} - {entry.entryCode}
                    </p>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <p>{entry.voteCount} votes</p>
                    <p>{entry.rank ? `Rank #${entry.rank}` : "Not ranked yet"}</p>
                </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
                <video controls className="aspect-video w-full rounded-[1.5rem] bg-black/90 object-cover" src={entry.presentationVideoUrl} />
                <video controls className="aspect-video w-full rounded-[1.5rem] bg-black/90 object-cover" src={entry.cookingProcessVideoUrl} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select value={status} onChange={(event) => setStatus(event.target.value as "approved" | "rejected")} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <Input value={creativityScore} onChange={(event) => setCreativityScore(event.target.value)} placeholder="Creativity /100" className="h-11 rounded-2xl" />
                <Input value={presentationScore} onChange={(event) => setPresentationScore(event.target.value)} placeholder="Presentation /100" className="h-11 rounded-2xl" />
                <Input value={winnerPosition} onChange={(event) => setWinnerPosition(event.target.value)} placeholder="Winner position" className="h-11 rounded-2xl" />
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                    <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
                    Featured
                </label>
            </div>

            <Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Admin feedback" className="mt-4 min-h-24 rounded-2xl" />

            <Button type="button" onClick={() => void handleSave()} disabled={saving} className="mt-4 rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save review
            </Button>
        </article>
    )
}

export function CookOffAdminClient({ initialData }: { initialData: CookOffAdminDashboard }) {
    const router = useRouter()
    const defaultSessionId = initialData.sessions.find((session) => session.status === "active")?.id ?? initialData.sessions[0]?.id ?? ""
    const [selectedSessionId, setSelectedSessionId] = useState(defaultSessionId)
    const [editingSlideId, setEditingSlideId] = useState<string | null>(initialData.slides[0]?.id ?? null)
    const [editingSessionId, setEditingSessionId] = useState<string | null>(initialData.sessions[0]?.id ?? null)
    const [slideForm, setSlideForm] = useState(() => buildSlideForm(initialData.slides[0] ?? null))
    const [sessionForm, setSessionForm] = useState(() => buildSessionForm(initialData.sessions[0] ?? null))
    const [slideSaving, setSlideSaving] = useState(false)
    const [sessionSaving, setSessionSaving] = useState(false)

    const selectedSessionEntries = useMemo(
        () => initialData.entries.filter((entry) => entry.sessionId === selectedSessionId),
        [initialData.entries, selectedSessionId]
    )
    const contactsEmailText = selectedSessionEntries.map((entry) => `${entry.submitterName} <${entry.submitterEmail}>`).join("\n")
    const contactsPhoneText = selectedSessionEntries.map((entry) => `${entry.submitterName}: ${entry.submitterPhone ?? "No phone"}`).join("\n")

    async function uploadAdminMedia(file: File, target: "hero-slide" | "session-hero", mediaType: "image" | "video") {
        const result = await uploadSignedCloudinaryAsset(
            file,
            (fileName, resourceType) => createAdminCookOffUploadSignature(fileName, resourceType, target),
            mediaType
        )

        return {
            publicId: result.publicId,
            url: result.secureUrl,
        }
    }

    const selectSlide = (slide: HeroSlideRow | null) => {
        setEditingSlideId(slide?.id ?? null)
        setSlideForm(buildSlideForm(slide))
    }

    const selectSession = (session: CookOffSessionRow | null) => {
        setEditingSessionId(session?.id ?? null)
        setSessionForm(buildSessionForm(session))
        if (session) {
            setSelectedSessionId(session.id)
        }
    }

    async function handleSlideMediaUpload(file: File) {
        try {
            const asset = await uploadAdminMedia(file, "hero-slide", slideForm.mediaType as "image" | "video")
            setSlideForm((current) => ({
                ...current,
                mediaPublicId: asset.publicId,
                mediaUrl: asset.url,
            }))
            toast.success("Slide media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload slide media.")
        }
    }

    async function handleSessionMediaUpload(file: File) {
        try {
            const asset = await uploadAdminMedia(file, "session-hero", sessionForm.heroMediaType as "image" | "video")
            setSessionForm((current) => ({
                ...current,
                heroMediaPublicId: asset.publicId,
                heroMediaUrl: asset.url,
            }))
            toast.success("Session hero media uploaded.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload session media.")
        }
    }

    async function handleDeleteSlide(slideId: string) {
        const confirmed = window.confirm("Delete this hero slide?")
        if (!confirmed) {
            return
        }

        try {
            await deleteHeroSlide(slideId)
            toast.success("Hero slide deleted.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete slide.")
        }
    }

    async function saveSlide() {
        setSlideSaving(true)
        try {
            if (editingSlideId) {
                await updateHeroSlide(editingSlideId, slideForm)
            } else {
                await createHeroSlide(slideForm)
            }
            toast.success("Hero slide saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save slide.")
        } finally {
            setSlideSaving(false)
        }
    }

    async function saveSession() {
        setSessionSaving(true)
        try {
            if (editingSessionId) {
                await updateCookOffSession(editingSessionId, sessionForm)
            } else {
                await createCookOffSession(sessionForm)
            }
            toast.success("Cook-Off session saved.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save session.")
        } finally {
            setSessionSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
                {[
                    { label: "Hero slides", value: initialData.slides.length, icon: Sparkles },
                    { label: "Active slides", value: initialData.stats.activeSlides, icon: Video },
                    { label: "Cook-Off sessions", value: initialData.stats.totalSessions, icon: Trophy },
                    { label: "Entries", value: initialData.stats.totalEntries, icon: Copy },
                ].map((item) => (
                    <div key={item.label} className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <item.icon className="h-5 w-5 text-[#F58220]" />
                        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{item.label}</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hero marketing slides</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage the storefront carousel that powers the homepage, retail, and wholesale hero.</p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => selectSlide(null)}>New slide</Button>
                    </div>

                    <div className="grid gap-3">
                        {initialData.slides.map((slide) => (
                            <div key={slide.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900 dark:text-white">{slide.title}</p>
                                        <Badge>{slide.marketing_mode}</Badge>
                                        {slide.is_active ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge> : null}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Order {slide.sort_order} - {slide.media_type}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="rounded-full" onClick={() => selectSlide(slide)}>Edit</Button>
                                    <Button type="button" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteSlide(slide.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input value={slideForm.title} onChange={(event) => setSlideForm((current) => ({ ...current, title: event.target.value }))} placeholder="Slide title" className="h-11 rounded-2xl" />
                        <Input value={slideForm.eyebrowText} onChange={(event) => setSlideForm((current) => ({ ...current, eyebrowText: event.target.value }))} placeholder="Eyebrow text" className="h-11 rounded-2xl" />
                        <Input value={slideForm.highlightText} onChange={(event) => setSlideForm((current) => ({ ...current, highlightText: event.target.value }))} placeholder="Highlight text" className="h-11 rounded-2xl" />
                        <Input value={slideForm.buttonText} onChange={(event) => setSlideForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder="Button text" className="h-11 rounded-2xl" />
                        <Input value={slideForm.buttonUrl} onChange={(event) => setSlideForm((current) => ({ ...current, buttonUrl: event.target.value }))} placeholder="Button URL" className="h-11 rounded-2xl" />
                        <Input type="number" value={slideForm.sortOrder} onChange={(event) => setSlideForm((current) => ({ ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} placeholder="Sort order" className="h-11 rounded-2xl" />
                        <select value={slideForm.marketingMode} onChange={(event) => setSlideForm((current) => ({ ...current, marketingMode: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="standard">Standard</option>
                            <option value="cook_off">Cook-Off</option>
                            <option value="discount_bundles">Discount Bundles</option>
                        </select>
                        <select value={slideForm.mediaType} onChange={(event) => setSlideForm((current) => ({ ...current, mediaType: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                        </select>
                    </div>

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
                    <Button type="button" onClick={() => void saveSlide()} disabled={slideSaving} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        {slideSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save slide
                    </Button>
                </section>

                <section className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cook-Off sessions</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create monthly sessions, activate the live challenge, and manage the admin-editable portal content.</p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => selectSession(null)}>New session</Button>
                    </div>

                    <div className="grid gap-3">
                        {initialData.sessions.map((session) => (
                            <button key={session.id} type="button" onClick={() => selectSession(session)} className={cn("flex items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition", selectedSessionId === session.id ? "border-[#F58220] bg-orange-50 dark:bg-orange-950/10" : "border-gray-100 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-950/40")}>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900 dark:text-white">{session.title}</p>
                                        <Badge>{session.status}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{session.month_label} - {session.theme}</p>
                                </div>
                                <div className="text-xs text-gray-400">{formatDate(session.created_at)}</div>
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input value={sessionForm.title} onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))} placeholder="Session title" className="h-11 rounded-2xl" />
                        <Input value={sessionForm.theme} onChange={(event) => setSessionForm((current) => ({ ...current, theme: event.target.value }))} placeholder="Theme" className="h-11 rounded-2xl" />
                        <Input value={sessionForm.monthLabel} onChange={(event) => setSessionForm((current) => ({ ...current, monthLabel: event.target.value }))} placeholder="Month label" className="h-11 rounded-2xl" />
                        <Input value={sessionForm.slug} onChange={(event) => setSessionForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Slug" className="h-11 rounded-2xl" />
                        <Input value={sessionForm.ctaText} onChange={(event) => setSessionForm((current) => ({ ...current, ctaText: event.target.value }))} placeholder="CTA text" className="h-11 rounded-2xl" />
                        <select value={sessionForm.status} onChange={(event) => setSessionForm((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    <Textarea value={sessionForm.summary} onChange={(event) => setSessionForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Summary" className="min-h-20 rounded-2xl" />
                    <Textarea value={sessionForm.description} onChange={(event) => setSessionForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-28 rounded-2xl" />
                    <Textarea value={sessionForm.rules} onChange={(event) => setSessionForm((current) => ({ ...current, rules: event.target.value }))} placeholder="Rules" className="min-h-24 rounded-2xl" />
                    <Textarea value={sessionForm.prizes} onChange={(event) => setSessionForm((current) => ({ ...current, prizes: event.target.value }))} placeholder="Prizes" className="min-h-24 rounded-2xl" />
                    <select value={sessionForm.heroMediaType} onChange={(event) => setSessionForm((current) => ({ ...current, heroMediaType: event.target.value }))} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <option value="image">Image hero</option>
                        <option value="video">Video hero</option>
                    </select>
                    <input type="file" accept={sessionForm.heroMediaType === "video" ? "video/*" : "image/*"} onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void handleSessionMediaUpload(file)
                    }} className="block w-full text-sm text-gray-500" />
                    {sessionForm.heroMediaUrl ? <p className="text-xs text-gray-400 break-all">{sessionForm.heroMediaUrl}</p> : null}
                    <Button type="button" onClick={() => void saveSession()} disabled={sessionSaving} className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        {sessionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save session
                    </Button>
                </section>
            </div>

            <section className="space-y-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Entry moderation</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review entries for the selected session and copy manual contact lists when needed.</p>
                    </div>
                    <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                        {initialData.sessions.map((session) => (
                            <option key={session.id} value={session.id}>{session.month_label} - {session.title}</option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 dark:text-white">Emails</p>
                            <Button type="button" variant="outline" className="rounded-full" onClick={() => copyText(contactsEmailText, "Emails")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                            </Button>
                        </div>
                        <Textarea value={contactsEmailText} readOnly className="mt-4 min-h-40 rounded-2xl" />
                    </div>
                    <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 dark:text-white">Phone numbers</p>
                            <Button type="button" variant="outline" className="rounded-full" onClick={() => copyText(contactsPhoneText, "Phone numbers")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                            </Button>
                        </div>
                        <Textarea value={contactsPhoneText} readOnly className="mt-4 min-h-40 rounded-2xl" />
                    </div>
                </div>

                <div className="grid gap-4">
                    {selectedSessionEntries.length === 0 ? (
                        <div className="rounded-[1.75rem] border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-gray-400">
                            No entries found for this session yet.
                        </div>
                    ) : (
                        selectedSessionEntries.map((entry) => <ReviewCard key={entry.id} entry={entry} />)
                    )}
                </div>
            </section>
        </div>
    )
}
