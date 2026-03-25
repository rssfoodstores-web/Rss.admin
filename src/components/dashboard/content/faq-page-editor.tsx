"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleHelp, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { FaqPageContent, FaqPageItem } from "@/lib/contentPages"

interface FaqPageEditorProps {
    initialData: FaqPageContent
    pageLabel: string
    publicPath: string
    saveAction: (input: FaqPageContent) => Promise<{ success: boolean }>
}

function buildDraftItem(): FaqPageItem {
    return {
        id: `faq-${Date.now()}`,
        question: "",
        answer: "",
    }
}

export function FaqPageEditor({ initialData, pageLabel, publicPath, saveAction }: FaqPageEditorProps) {
    const router = useRouter()
    const [formState, setFormState] = useState<FaqPageContent>(() => ({
        pageTitle: initialData.pageTitle,
        introDescription: initialData.introDescription,
        items: initialData.items.map((item) => ({ ...item })),
    }))
    const [isPending, startTransition] = useTransition()

    function updateItem(index: number, field: keyof FaqPageItem, value: string) {
        setFormState((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item
            ),
        }))
    }

    function addItem() {
        setFormState((current) => ({
            ...current,
            items: [...current.items, buildDraftItem()],
        }))
    }

    function removeItem(index: number) {
        setFormState((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }))
    }

    function handleSave() {
        startTransition(async () => {
            try {
                await saveAction(formState)
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
                    <CircleHelp className="h-5 w-5 text-[#F58220]" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page copy</h2>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the FAQ page heading and intro text. Public route: <span className="font-semibold text-gray-700 dark:text-gray-200">{publicPath}</span>
                </p>

                <div className="mt-6 grid gap-4">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Page title</span>
                        <Input
                            value={formState.pageTitle}
                            onChange={(event) => setFormState((current) => ({ ...current, pageTitle: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intro description</span>
                        <Textarea
                            value={formState.introDescription}
                            onChange={(event) => setFormState((current) => ({ ...current, introDescription: event.target.value }))}
                            className="min-h-28 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">FAQ items</h2>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Add, remove, and edit the questions customers see on the public FAQ page.
                        </p>
                    </div>

                    <Button type="button" variant="outline" className="rounded-full" onClick={addItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add item
                    </Button>
                </div>

                <div className="mt-6 space-y-4">
                    {formState.items.map((item, index) => (
                        <div key={item.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                            <div className="grid gap-4">
                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Question</span>
                                    <Input
                                        value={item.question}
                                        onChange={(event) => updateItem(index, "question", event.target.value)}
                                        className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Answer</span>
                                    <Textarea
                                        value={item.answer}
                                        onChange={(event) => updateItem(index, "answer", event.target.value)}
                                        className="min-h-28 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                                    onClick={() => removeItem(index)}
                                    disabled={formState.items.length <= 1}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove item
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
