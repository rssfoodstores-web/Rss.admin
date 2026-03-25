"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentPageContent } from "@/lib/contentPages"

interface DocumentPageEditorProps {
    initialData: DocumentPageContent
    pageLabel: string
    publicPath: string
    saveAction: (input: DocumentPageContent) => Promise<{ success: boolean }>
}

interface DocumentSectionFormState {
    id: string
    title: string
    paragraphsText: string
    bulletsText: string
    note: string
}

interface DocumentPageFormState {
    badge: string
    pageTitle: string
    introDescription: string
    sections: DocumentSectionFormState[]
    closingTitle: string
    closingDescription: string
}

function joinParagraphs(paragraphs: string[]) {
    return paragraphs.join("\n\n")
}

function joinBullets(bullets: string[]) {
    return bullets.join("\n")
}

function buildFormState(data: DocumentPageContent): DocumentPageFormState {
    return {
        badge: data.badge,
        pageTitle: data.pageTitle,
        introDescription: data.introDescription,
        sections: data.sections.map((section) => ({
            id: section.id,
            title: section.title,
            paragraphsText: joinParagraphs(section.paragraphs),
            bulletsText: joinBullets(section.bullets),
            note: section.note,
        })),
        closingTitle: data.closingTitle,
        closingDescription: data.closingDescription,
    }
}

function buildDraftSection(): DocumentSectionFormState {
    return {
        id: `section-${Date.now()}`,
        title: "",
        paragraphsText: "",
        bulletsText: "",
        note: "",
    }
}

function splitParagraphs(value: string) {
    return value
        .split(/\n\s*\n/g)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
}

function splitBullets(value: string) {
    return value
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
}

function toContent(formState: DocumentPageFormState): DocumentPageContent {
    return {
        badge: formState.badge,
        pageTitle: formState.pageTitle,
        introDescription: formState.introDescription,
        sections: formState.sections.map((section) => ({
            id: section.id,
            title: section.title,
            paragraphs: splitParagraphs(section.paragraphsText),
            bullets: splitBullets(section.bulletsText),
            note: section.note.trim(),
        })),
        closingTitle: formState.closingTitle,
        closingDescription: formState.closingDescription,
    }
}

export function DocumentPageEditor({ initialData, pageLabel, publicPath, saveAction }: DocumentPageEditorProps) {
    const router = useRouter()
    const [formState, setFormState] = useState(() => buildFormState(initialData))
    const [isPending, startTransition] = useTransition()

    function updateSection(index: number, field: keyof DocumentSectionFormState, value: string) {
        setFormState((current) => ({
            ...current,
            sections: current.sections.map((section, sectionIndex) =>
                sectionIndex === index
                    ? {
                        ...section,
                        [field]: value,
                    }
                    : section
            ),
        }))
    }

    function addSection() {
        setFormState((current) => ({
            ...current,
            sections: [...current.sections, buildDraftSection()],
        }))
    }

    function removeSection(index: number) {
        setFormState((current) => ({
            ...current,
            sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
        }))
    }

    function handleSave() {
        startTransition(async () => {
            try {
                await saveAction(toContent(formState))
                toast.success(`${pageLabel} saved.`)
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : `Unable to save ${pageLabel.toLowerCase()}.`)
            }
        })
    }

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#F58220]" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page copy</h2>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the public page heading and supporting copy. Public route: <span className="font-semibold text-gray-700 dark:text-gray-200">{publicPath}</span>
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Badge label</span>
                        <Input
                            value={formState.badge}
                            onChange={(event) => setFormState((current) => ({ ...current, badge: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Page title</span>
                        <Input
                            value={formState.pageTitle}
                            onChange={(event) => setFormState((current) => ({ ...current, pageTitle: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intro description</span>
                        <Textarea
                            value={formState.introDescription}
                            onChange={(event) => setFormState((current) => ({ ...current, introDescription: event.target.value }))}
                            className="min-h-28 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Closing title</span>
                        <Input
                            value={formState.closingTitle}
                            onChange={(event) => setFormState((current) => ({ ...current, closingTitle: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Closing description</span>
                        <Textarea
                            value={formState.closingDescription}
                            onChange={(event) => setFormState((current) => ({ ...current, closingDescription: event.target.value }))}
                            className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sections</h2>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Each section supports a title, paragraph blocks, bullet lines, and an optional highlighted note.
                        </p>
                    </div>

                    <Button type="button" variant="outline" className="rounded-full" onClick={addSection}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add section
                    </Button>
                </div>

                <div className="mt-6 space-y-4">
                    {formState.sections.map((section, index) => (
                        <div key={section.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                            <div className="grid gap-4">
                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Section title</span>
                                    <Input
                                        value={section.title}
                                        onChange={(event) => updateSection(index, "title", event.target.value)}
                                        className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Paragraphs</span>
                                    <Textarea
                                        value={section.paragraphsText}
                                        onChange={(event) => updateSection(index, "paragraphsText", event.target.value)}
                                        className="min-h-36 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                                        placeholder="Separate paragraphs with a blank line."
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bullets</span>
                                    <Textarea
                                        value={section.bulletsText}
                                        onChange={(event) => updateSection(index, "bulletsText", event.target.value)}
                                        className="min-h-28 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                                        placeholder="Write one bullet per line."
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Highlighted note</span>
                                    <Textarea
                                        value={section.note}
                                        onChange={(event) => updateSection(index, "note", event.target.value)}
                                        className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                                    onClick={() => removeSection(index)}
                                    disabled={formState.sections.length <= 1}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove section
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex justify-end">
                <Button
                    type="button"
                    className="rounded-full bg-[#F58220] px-6 text-white hover:bg-[#F58220]/90"
                    onClick={handleSave}
                    disabled={isPending}
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? "Saving..." : `Save ${pageLabel}`}
                </Button>
            </div>
        </div>
    )
}
