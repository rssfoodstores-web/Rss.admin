"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Mail, Phone, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CONTACT_METHOD_TYPES, type ContactMethodContent, type ContactPageContent } from "@/lib/contactPage"
import { saveContactPageContent } from "./actions"

interface ContactAdminClientProps {
    initialData: ContactPageContent
}

interface ContactPageFormState {
    form: ContactPageContent["form"]
    introDescription: string
    introTitle: string
    methods: ContactMethodContent[]
    pageTitle: string
}

function buildFormState(data: ContactPageContent): ContactPageFormState {
    return {
        form: { ...data.form },
        introDescription: data.introDescription,
        introTitle: data.introTitle,
        methods: data.methods.map((method) => ({ ...method })),
        pageTitle: data.pageTitle,
    }
}

function buildDraftMethod(): ContactMethodContent {
    return {
        description: "",
        id: `contact-method-${Date.now()}`,
        title: "",
        type: "custom",
        value: "",
    }
}

export function ContactAdminClient({ initialData }: ContactAdminClientProps) {
    const router = useRouter()
    const [formState, setFormState] = useState(() => buildFormState(initialData))
    const [isPending, startTransition] = useTransition()

    function updateMethod(index: number, field: keyof ContactMethodContent, value: string) {
        setFormState((current) => ({
            ...current,
            methods: current.methods.map((method, methodIndex) =>
                methodIndex === index
                    ? {
                        ...method,
                        [field]: value,
                    }
                    : method
            ),
        }))
    }

    function addMethod() {
        setFormState((current) => ({
            ...current,
            methods: [...current.methods, buildDraftMethod()],
        }))
    }

    function removeMethod(index: number) {
        setFormState((current) => ({
            ...current,
            methods: current.methods.filter((_, methodIndex) => methodIndex !== index),
        }))
    }

    function handleSave() {
        startTransition(async () => {
            try {
                await saveContactPageContent(formState)
                toast.success("Contact page content saved.")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save contact page content.")
            }
        })
    }

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-[#F58220]" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page copy</h2>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the public contact page heading, intro copy, form placeholders, and button text.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Page title</span>
                        <Input
                            value={formState.pageTitle}
                            onChange={(event) => setFormState((current) => ({ ...current, pageTitle: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intro title</span>
                        <Input
                            value={formState.introTitle}
                            onChange={(event) => setFormState((current) => ({ ...current, introTitle: event.target.value }))}
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
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">First name placeholder</span>
                        <Input
                            value={formState.form.firstNamePlaceholder}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    form: { ...current.form, firstNamePlaceholder: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Last name placeholder</span>
                        <Input
                            value={formState.form.lastNamePlaceholder}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    form: { ...current.form, lastNamePlaceholder: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email placeholder</span>
                        <Input
                            value={formState.form.emailPlaceholder}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    form: { ...current.form, emailPlaceholder: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Button text</span>
                        <Input
                            value={formState.form.buttonText}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    form: { ...current.form, buttonText: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Message placeholder</span>
                        <Textarea
                            value={formState.form.messagePlaceholder}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    form: { ...current.form, messagePlaceholder: event.target.value },
                                }))
                            }
                            className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Phone className="h-5 w-5 text-violet-700" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contact methods</h2>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Add, remove, and edit the ways customers can reach the business on the contact page.
                        </p>
                    </div>

                    <Button type="button" variant="outline" className="rounded-full" onClick={addMethod}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add method
                    </Button>
                </div>

                <div className="mt-6 space-y-4">
                    {formState.methods.map((method, index) => (
                        <div key={method.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Type</span>
                                    <select
                                        value={method.type}
                                        onChange={(event) => updateMethod(index, "type", event.target.value)}
                                        className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/50"
                                    >
                                        {CONTACT_METHOD_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Title</span>
                                    <Input
                                        value={method.title}
                                        onChange={(event) => updateMethod(index, "title", event.target.value)}
                                        className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>

                                <label className="space-y-2 md:col-span-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Value</span>
                                    <Input
                                        value={method.value}
                                        onChange={(event) => updateMethod(index, "value", event.target.value)}
                                        className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                                        placeholder="Phone, email, address, WhatsApp number, or website link"
                                    />
                                </label>

                                <label className="space-y-2 md:col-span-2">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</span>
                                    <Textarea
                                        value={method.description}
                                        onChange={(event) => updateMethod(index, "description", event.target.value)}
                                        className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-800/50"
                                    />
                                </label>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                                    onClick={() => removeMethod(index)}
                                    disabled={formState.methods.length <= 1}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove method
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex justify-end">
                <Button type="button" className="rounded-full bg-[#F58220] px-6 text-white hover:bg-[#F58220]/90" onClick={handleSave} disabled={isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? "Saving..." : "Save contact page"}
                </Button>
            </div>
        </div>
    )
}
