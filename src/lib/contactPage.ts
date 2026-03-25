export const CONTACT_PAGE_SETTING_KEY = "contact_page_content"

export const CONTACT_METHOD_TYPES = ["address", "email", "phone", "whatsapp", "website", "custom"] as const

export type ContactMethodType = (typeof CONTACT_METHOD_TYPES)[number]

export interface ContactMethodContent {
    description: string
    id: string
    title: string
    type: ContactMethodType
    value: string
}

export interface ContactFormContent {
    buttonText: string
    emailPlaceholder: string
    firstNamePlaceholder: string
    lastNamePlaceholder: string
    messagePlaceholder: string
}

export interface ContactPageContent {
    form: ContactFormContent
    introDescription: string
    introTitle: string
    methods: ContactMethodContent[]
    pageTitle: string
}

export const DEFAULT_CONTACT_PAGE_CONTENT: ContactPageContent = {
    form: {
        buttonText: "Send Message",
        emailPlaceholder: "Email",
        firstNamePlaceholder: "First Name",
        lastNamePlaceholder: "Last Name",
        messagePlaceholder: "Subjects",
    },
    introDescription: "Do you fancy saying hi to me or you want to get started with your project and you need my help? Feel free to contact me.",
    introTitle: "Just Say Hello!",
    methods: [
        {
            description: "Our main office location.",
            id: "address-main",
            title: "Visit us",
            type: "address",
            value: "OTK Industries Nigeria Ltd, Lagos, Nigeria",
        },
        {
            description: "For general enquiries and support.",
            id: "email-main",
            title: "Email us",
            type: "email",
            value: "hello@myrss.com.ng",
        },
        {
            description: "Speak directly with the support team.",
            id: "phone-main",
            title: "Call us",
            type: "phone",
            value: "+234 903 019 854",
        },
    ],
    pageTitle: "Contact Us",
}

function normalizeText(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function isContactMethodType(value: unknown): value is ContactMethodType {
    return typeof value === "string" && CONTACT_METHOD_TYPES.includes(value as ContactMethodType)
}

function normalizeMethods(value: unknown): ContactMethodContent[] {
    if (!Array.isArray(value)) {
        return DEFAULT_CONTACT_PAGE_CONTENT.methods
    }

    const methods = value
        .map((item, index) => {
            const row = item && typeof item === "object" ? item as Record<string, unknown> : {}
            const fallback = DEFAULT_CONTACT_PAGE_CONTENT.methods[index] ?? DEFAULT_CONTACT_PAGE_CONTENT.methods[0]

            return {
                description: typeof row.description === "string" ? row.description.trim() : fallback.description,
                id: normalizeText(row.id, `contact-method-${index + 1}`),
                title: normalizeText(row.title, fallback.title),
                type: isContactMethodType(row.type) ? row.type : fallback.type,
                value: normalizeText(row.value, fallback.value),
            }
        })
        .filter((method) => method.title && method.value)

    return methods.length > 0 ? methods : DEFAULT_CONTACT_PAGE_CONTENT.methods
}

export function normalizeContactPageContent(value: unknown): ContactPageContent {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {}
    const form = row.form && typeof row.form === "object" ? row.form as Record<string, unknown> : {}

    return {
        form: {
            buttonText: normalizeText(form.button_text, DEFAULT_CONTACT_PAGE_CONTENT.form.buttonText),
            emailPlaceholder: normalizeText(form.email_placeholder, DEFAULT_CONTACT_PAGE_CONTENT.form.emailPlaceholder),
            firstNamePlaceholder: normalizeText(form.first_name_placeholder, DEFAULT_CONTACT_PAGE_CONTENT.form.firstNamePlaceholder),
            lastNamePlaceholder: normalizeText(form.last_name_placeholder, DEFAULT_CONTACT_PAGE_CONTENT.form.lastNamePlaceholder),
            messagePlaceholder: normalizeText(form.message_placeholder, DEFAULT_CONTACT_PAGE_CONTENT.form.messagePlaceholder),
        },
        introDescription: normalizeText(row.intro_description, DEFAULT_CONTACT_PAGE_CONTENT.introDescription),
        introTitle: normalizeText(row.intro_title, DEFAULT_CONTACT_PAGE_CONTENT.introTitle),
        methods: normalizeMethods(row.methods),
        pageTitle: normalizeText(row.page_title, DEFAULT_CONTACT_PAGE_CONTENT.pageTitle),
    }
}

function sanitizePhoneNumber(value: string) {
    return value.replace(/[^\d+]/g, "")
}

function sanitizeWhatsAppNumber(value: string) {
    return value.replace(/\D/g, "")
}

export function buildContactMethodHref(method: ContactMethodContent) {
    switch (method.type) {
        case "email":
            return `mailto:${method.value}`
        case "phone":
            return `tel:${sanitizePhoneNumber(method.value)}`
        case "whatsapp": {
            const digits = sanitizeWhatsAppNumber(method.value)
            return digits ? `https://wa.me/${digits}` : null
        }
        case "website":
            return /^https?:\/\//i.test(method.value) ? method.value : `https://${method.value}`
        case "custom":
            return /^https?:\/\//i.test(method.value) ? method.value : null
        case "address":
        default:
            return null
    }
}
