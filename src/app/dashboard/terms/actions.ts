"use server"

import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import {
    DEFAULT_TERMS_PAGE_CONTENT,
    TERMS_PAGE_SETTING_KEY,
    normalizeDocumentPageContent,
    type DocumentPageContent,
    type DocumentPageSection,
} from "@/lib/contentPages"

function normalizeRequiredText(value: string, fieldName: string) {
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
    const access = await requireAdminRouteAccess("terms")
    return access.supabase
}

function validateSections(sections: DocumentPageSection[]) {
    if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error("Add at least one section.")
    }

    if (sections.length > 12) {
        throw new Error("Keep sections to 12 or fewer.")
    }

    return sections.map((section, index) => {
        const paragraphs = (section.paragraphs ?? [])
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0)
        const bullets = (section.bullets ?? [])
            .map((bullet) => bullet.trim())
            .filter((bullet) => bullet.length > 0)

        if (paragraphs.length === 0 && bullets.length === 0 && !section.note.trim()) {
            throw new Error(`Section ${index + 1} needs paragraphs, bullets, or a highlighted note.`)
        }

        return {
            id: normalizeRequiredText(section.id ?? `section-${index + 1}`, `Section ${index + 1} id`),
            title: normalizeRequiredText(section.title ?? "", `Section ${index + 1} title`),
            paragraphs,
            bullets,
            note: normalizeOptionalText(section.note ?? ""),
        }
    })
}

function toStoredValue(input: DocumentPageContent) {
    return {
        badge: normalizeRequiredText(input.badge, "Badge label"),
        page_title: normalizeRequiredText(input.pageTitle, "Page title"),
        intro_description: normalizeRequiredText(input.introDescription, "Intro description"),
        sections: validateSections(input.sections),
        closing_title: normalizeRequiredText(input.closingTitle, "Closing title"),
        closing_description: normalizeRequiredText(input.closingDescription, "Closing description"),
    }
}

export async function getTermsAdminData(): Promise<DocumentPageContent> {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", TERMS_PAGE_SETTING_KEY)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    return normalizeDocumentPageContent(data?.value ?? DEFAULT_TERMS_PAGE_CONTENT, DEFAULT_TERMS_PAGE_CONTENT)
}

export async function saveTermsPageContent(input: DocumentPageContent) {
    const supabase = await requireAdmin()
    const value = toStoredValue(input)

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: TERMS_PAGE_SETTING_KEY,
            value,
            description: "Editable public terms and conditions page content.",
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath("/terms")
    revalidatePath("/dashboard/terms")
    revalidatePath("/dashboard/settings")

    return { success: true }
}
