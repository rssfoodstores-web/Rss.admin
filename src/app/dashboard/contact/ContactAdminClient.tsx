"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Mail, Phone, Plus, Save, Share2, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { CONTACT_METHOD_TYPES, type ContactMethodContent, type ContactPageContent } from "@/lib/contactPage"
import { createClient } from "@/lib/supabase/client"
import { SocialMediaForm } from "@/components/dashboard/settings/social-media-form"
import { saveContactPageContent, type NewsletterSubscriptionItem } from "./actions"
import type { SocialMediaLink } from "@/types/social-media"

interface ContactAdminClientProps {
    initialData: ContactPageContent
    initialNewsletterSubscriptions: NewsletterSubscriptionItem[]
    initialSocialLinks: SocialMediaLink[]
}

interface ContactPageFormState {
    form: ContactPageContent["form"]
    introDescription: string
    introTitle: string
    methods: ContactMethodContent[]
    newsletter: ContactPageContent["newsletter"]
    pageTitle: string
}

function buildFormState(data: ContactPageContent): ContactPageFormState {
    return {
        form: { ...data.form },
        introDescription: data.introDescription,
        introTitle: data.introTitle,
        methods: data.methods.map((method) => ({ ...method })),
        newsletter: { ...data.newsletter },
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

function formatSubscriptionDate(value: string) {
    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
        return "Unknown date"
    }

    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(parsed)
}

export function ContactAdminClient({
    initialData,
    initialNewsletterSubscriptions,
    initialSocialLinks,
}: ContactAdminClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const [formState, setFormState] = useState(() => buildFormState(initialData))
    const [newsletterSubscriptions, setNewsletterSubscriptions] = useState(initialNewsletterSubscriptions)
    const [socialLinks, setSocialLinks] = useState(initialSocialLinks)
    const [isPending, startTransition] = useTransition()
    const [isSocialDialogOpen, setIsSocialDialogOpen] = useState(false)
    const [editingSocialLink, setEditingSocialLink] = useState<SocialMediaLink | undefined>(undefined)

    useEffect(() => {
        setNewsletterSubscriptions(initialNewsletterSubscriptions)
    }, [initialNewsletterSubscriptions])

    useEffect(() => {
        setSocialLinks(initialSocialLinks)
    }, [initialSocialLinks])

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

    function handleOpenAddSocialDialog() {
        setEditingSocialLink(undefined)
        setIsSocialDialogOpen(true)
    }

    function handleOpenEditSocialDialog(link: SocialMediaLink) {
        setEditingSocialLink(link)
        setIsSocialDialogOpen(true)
    }

    function handleCloseSocialDialog() {
        setEditingSocialLink(undefined)
        setIsSocialDialogOpen(false)
    }

    function handleSocialSuccess() {
        handleCloseSocialDialog()
        router.refresh()
    }

    async function handleDeleteSocialLink(id: number) {
        try {
            const { error } = await supabase
                .from("social_media_links")
                .delete()
                .eq("id", id)

            if (error) {
                throw error
            }

            setSocialLinks((current) => current.filter((link) => link.id !== id))
            toast.success("Social media link deleted.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete the social media link.")
        }
    }

    async function handleCopySubscriberEmails() {
        const emailText = newsletterSubscriptions.map((subscription) => subscription.email).join(", ")

        try {
            await navigator.clipboard.writeText(emailText)
            toast.success("Subscriber emails copied.")
        } catch {
            toast.error("Unable to copy subscriber emails.")
        }
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
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#F58220]" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Newsletter section</h2>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Control the footer newsletter heading, copy, placeholder, and submit button label.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Newsletter title</span>
                        <Input
                            value={formState.newsletter.title}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    newsletter: { ...current.newsletter, title: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Newsletter button text</span>
                        <Input
                            value={formState.newsletter.buttonText}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    newsletter: { ...current.newsletter, buttonText: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Newsletter email placeholder</span>
                        <Input
                            value={formState.newsletter.emailPlaceholder}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    newsletter: { ...current.newsletter, emailPlaceholder: event.target.value },
                                }))
                            }
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Newsletter description</span>
                        <Textarea
                            value={formState.newsletter.description}
                            onChange={(event) =>
                                setFormState((current) => ({
                                    ...current,
                                    newsletter: { ...current.newsletter, description: event.target.value },
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
                            Add, remove, and edit the ways customers can reach the business on the contact page, footer, and header.
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

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-[#F58220]" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Newsletter subscribers</h2>
                            <Badge variant="secondary" className="rounded-full">
                                {newsletterSubscriptions.length}
                            </Badge>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Every email submitted through the storefront newsletter form appears here.
                        </p>
                    </div>

                    {newsletterSubscriptions.length > 0 ? (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleCopySubscriberEmails()}>
                            Copy emails
                        </Button>
                    ) : null}
                </div>

                {newsletterSubscriptions.length > 0 ? (
                    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(180px,0.9fr)] gap-4 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:bg-zinc-800/50 dark:text-gray-400">
                            <span>Email</span>
                            <span>Source</span>
                            <span>Subscribed</span>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {newsletterSubscriptions.map((subscription) => (
                                <div key={subscription.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(180px,0.9fr)] gap-4 px-4 py-4 text-sm">
                                    <span className="truncate font-semibold text-gray-900 dark:text-white">{subscription.email}</span>
                                    <span className="capitalize text-gray-500 dark:text-gray-400">{subscription.source ?? "footer"}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{formatSubscriptionDate(subscription.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-400">
                        No newsletter subscriptions yet.
                    </div>
                )}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Share2 className="h-5 w-5 text-[#F58220]" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Social media links</h2>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Manage the social platforms shown in the storefront footer.
                        </p>
                    </div>

                    <Dialog open={isSocialDialogOpen} onOpenChange={setIsSocialDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" className="rounded-full" onClick={handleOpenAddSocialDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add social link
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{editingSocialLink ? "Edit social media link" : "Add social media link"}</DialogTitle>
                                <DialogDescription>
                                    Add or update a footer social link from this contact-page settings screen.
                                </DialogDescription>
                            </DialogHeader>
                            <SocialMediaForm initialData={editingSocialLink} onSuccess={handleSocialSuccess} />
                        </DialogContent>
                    </Dialog>
                </div>

                {socialLinks.length > 0 ? (
                    <div className="mt-6 space-y-3">
                        {socialLinks.map((link) => (
                            <div key={link.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <p className="font-semibold text-gray-900 dark:text-white">{link.platform}</p>
                                        <Badge variant={link.is_active ? "default" : "secondary"} className="rounded-full">
                                            {link.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-gray-500 transition-colors hover:text-[#F58220] dark:text-gray-400"
                                    >
                                        <span className="truncate">{link.url}</span>
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                    </a>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="rounded-full" onClick={() => handleOpenEditSocialDialog(link)}>
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                                        onClick={() => {
                                            if (window.confirm("Delete this social media link?")) {
                                                void handleDeleteSocialLink(link.id)
                                            }
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-400">
                        No social media links configured yet.
                    </div>
                )}
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
