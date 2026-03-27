"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    CONTACT_METHOD_TYPES,
    CONTACT_PAGE_SETTING_KEY,
    DEFAULT_CONTACT_PAGE_CONTENT,
    normalizeContactPageContent,
    type ContactMethodContent,
    type ContactPageContent,
} from "@/lib/contactPage"
import type { SocialMediaLink } from "@/types/social-media"

interface SaveContactPageInput {
    form: {
        buttonText: string
        emailPlaceholder: string
        firstNamePlaceholder: string
        lastNamePlaceholder: string
        messagePlaceholder: string
    }
    introDescription: string
    introTitle: string
    methods: ContactMethodContent[]
    newsletter: {
        buttonText: string
        description: string
        emailPlaceholder: string
        title: string
    }
    pageTitle: string
}

export interface NewsletterSubscriptionItem {
    created_at: string
    email: string
    id: string
    source: string | null
}

export interface ContactAdminData {
    content: ContactPageContent
    newsletterSubscriptions: NewsletterSubscriptionItem[]
    socialLinks: SocialMediaLink[]
}

function normalizeText(value: string, fieldName: string) {
    const normalized = value.trim()

    if (!normalized) {
        throw new Error(`${fieldName} is required.`)
    }

    return normalized
}

function normalizeOptionalText(value: string) {
    return value.trim()
}

async function requireAdmin() {
    const access = await requireAdminRouteAccess("contact")
    return access.supabase
}

function validateMethods(methods: ContactMethodContent[]) {
    if (!Array.isArray(methods) || methods.length === 0) {
        throw new Error("Add at least one contact method.")
    }

    if (methods.length > 8) {
        throw new Error("Keep contact methods to 8 or fewer.")
    }

    return methods.map((method, index) => {
        const type = CONTACT_METHOD_TYPES.includes(method.type) ? method.type : "custom"

        return {
            description: normalizeOptionalText(method.description ?? ""),
            id: normalizeText(method.id ?? `contact-method-${index + 1}`, `Contact method ${index + 1} id`),
            title: normalizeText(method.title ?? "", `Contact method ${index + 1} title`),
            type,
            value: normalizeText(method.value ?? "", `Contact method ${index + 1} value`),
        }
    })
}

function toStoredValue(input: SaveContactPageInput) {
    return {
        form: {
            button_text: normalizeText(input.form.buttonText, "Button text"),
            email_placeholder: normalizeText(input.form.emailPlaceholder, "Email placeholder"),
            first_name_placeholder: normalizeText(input.form.firstNamePlaceholder, "First name placeholder"),
            last_name_placeholder: normalizeText(input.form.lastNamePlaceholder, "Last name placeholder"),
            message_placeholder: normalizeText(input.form.messagePlaceholder, "Message placeholder"),
        },
        intro_description: normalizeText(input.introDescription, "Intro description"),
        intro_title: normalizeText(input.introTitle, "Intro title"),
        methods: validateMethods(input.methods),
        newsletter: {
            button_text: normalizeText(input.newsletter.buttonText, "Newsletter button text"),
            description: normalizeText(input.newsletter.description, "Newsletter description"),
            email_placeholder: normalizeText(input.newsletter.emailPlaceholder, "Newsletter email placeholder"),
            title: normalizeText(input.newsletter.title, "Newsletter title"),
        },
        page_title: normalizeText(input.pageTitle, "Page title"),
    }
}

export async function getContactAdminData(): Promise<ContactAdminData> {
    const supabase = await requireAdmin()
    const [
        { data: settingData, error: settingError },
        { data: subscriptionData, error: subscriptionError },
        { data: socialLinkData, error: socialLinkError },
    ] = await Promise.all([
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", CONTACT_PAGE_SETTING_KEY)
            .maybeSingle(),
        supabase
            .from("newsletter_subscriptions")
            .select("id, email, source, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
        supabase
            .from("social_media_links")
            .select("id, platform, url, is_active, created_at, updated_at")
            .order("created_at", { ascending: false }),
    ])

    if (settingError) {
        throw new Error(settingError.message)
    }

    if (subscriptionError && subscriptionError.code !== "42P01") {
        throw new Error(subscriptionError.message)
    }

    if (socialLinkError) {
        throw new Error(socialLinkError.message)
    }

    return {
        content: normalizeContactPageContent(settingData?.value ?? DEFAULT_CONTACT_PAGE_CONTENT),
        newsletterSubscriptions: subscriptionError?.code === "42P01"
            ? []
            : (subscriptionData ?? []) as NewsletterSubscriptionItem[],
        socialLinks: (socialLinkData ?? []) as SocialMediaLink[],
    }
}

export async function saveContactPageContent(input: SaveContactPageInput) {
    const supabase = await requireAdmin()
    const value = toStoredValue(input)

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: CONTACT_PAGE_SETTING_KEY,
            value,
            description: "Editable public contact page content, including intro copy, form labels, and contact methods.",
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/contact")
    revalidatePath("/dashboard/contact")
    revalidatePath("/dashboard/settings")

    return { success: true }
}
