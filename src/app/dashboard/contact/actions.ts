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
    pageTitle: string
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
        page_title: normalizeText(input.pageTitle, "Page title"),
    }
}

export async function getContactAdminData(): Promise<ContactPageContent> {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", CONTACT_PAGE_SETTING_KEY)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    return normalizeContactPageContent(data?.value ?? DEFAULT_CONTACT_PAGE_CONTENT)
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
