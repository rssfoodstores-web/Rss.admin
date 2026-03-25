"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    DEFAULT_FAQ_PAGE_CONTENT,
    FAQ_PAGE_SETTING_KEY,
    normalizeFaqPageContent,
    type FaqPageContent,
    type FaqPageItem,
} from "@/lib/contentPages"

function normalizeRequiredText(value: string, fieldName: string) {
    const normalized = value.trim()

    if (!normalized) {
        throw new Error(`${fieldName} is required.`)
    }

    return normalized
}

async function requireAdmin() {
    const access = await requireAdminRouteAccess("faqs")
    return access.supabase
}

function validateItems(items: FaqPageItem[]) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one FAQ item.")
    }

    if (items.length > 20) {
        throw new Error("Keep FAQ items to 20 or fewer.")
    }

    return items.map((item, index) => ({
        id: normalizeRequiredText(item.id ?? `faq-${index + 1}`, `FAQ item ${index + 1} id`),
        question: normalizeRequiredText(item.question ?? "", `FAQ item ${index + 1} question`),
        answer: normalizeRequiredText(item.answer ?? "", `FAQ item ${index + 1} answer`),
    }))
}

function toStoredValue(input: FaqPageContent) {
    return {
        page_title: normalizeRequiredText(input.pageTitle, "Page title"),
        intro_description: normalizeRequiredText(input.introDescription, "Intro description"),
        items: validateItems(input.items),
    }
}

export async function getFaqAdminData(): Promise<FaqPageContent> {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", FAQ_PAGE_SETTING_KEY)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    return normalizeFaqPageContent(data?.value ?? DEFAULT_FAQ_PAGE_CONTENT)
}

export async function saveFaqPageContent(input: FaqPageContent) {
    const supabase = await requireAdmin()
    const value = toStoredValue(input)

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: FAQ_PAGE_SETTING_KEY,
            value,
            description: "Editable public FAQ page content, including intro copy and question-answer entries.",
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/dashboard/faqs")
    revalidatePath("/dashboard/settings")

    return { success: true }
}
