export const FAQ_PAGE_SETTING_KEY = "faq_page_content"
export const TERMS_PAGE_SETTING_KEY = "terms_page_content"
export const PRIVACY_PAGE_SETTING_KEY = "privacy_page_content"

export interface FaqPageItem {
    id: string
    question: string
    answer: string
}

export interface FaqPageContent {
    pageTitle: string
    introDescription: string
    items: FaqPageItem[]
}

export interface DocumentPageSection {
    id: string
    title: string
    paragraphs: string[]
    bullets: string[]
    note: string
}

export interface DocumentPageContent {
    badge: string
    pageTitle: string
    introDescription: string
    sections: DocumentPageSection[]
    closingTitle: string
    closingDescription: string
}

export const DEFAULT_FAQ_PAGE_CONTENT: FaqPageContent = {
    pageTitle: "FAQs",
    introDescription: "Find quick answers to the questions customers ask most about delivery, payments, returns, and bulk orders.",
    items: [
        {
            id: "faq-delivery-time",
            question: "How long does delivery take?",
            answer: "Delivery typically takes 1 to 3 business days within major cities and 3 to 5 business days for other locations. We aim to process all orders within 24 hours of confirmation.",
        },
        {
            id: "faq-payment-methods",
            question: "What payment methods do you accept?",
            answer: "We accept major debit and credit cards, bank transfers, and secure online payments through our payment partners.",
        },
        {
            id: "faq-returns",
            question: "Can I return a product if I am not satisfied?",
            answer: "Yes. If you receive a damaged or incorrect item, inspect it on delivery and contact support within 24 hours so the team can help.",
        },
        {
            id: "faq-wholesale",
            question: "Do you offer bulk or wholesale pricing?",
            answer: "Yes. We support both retail and wholesale purchases. Visit the wholesale section or contact the sales team for larger corporate orders.",
        },
        {
            id: "faq-track-order",
            question: "How can I track my order?",
            answer: "After dispatch, you will receive tracking updates by email or SMS. You can also follow the order status from your account dashboard.",
        },
    ],
}

export const DEFAULT_TERMS_PAGE_CONTENT: DocumentPageContent = {
    badge: "Legal Framework",
    pageTitle: "General Terms & Conditions",
    introDescription: "Please read these terms carefully before using our platform. By accessing or using RSS Foods, you agree to be bound by these conditions.",
    sections: [
        {
            id: "terms-introduction",
            title: "Introduction",
            paragraphs: [
                "RSS Foods is the trading name for the RSS Foods ecommerce platform, operated through our website and mobile application. We provide an online marketplace together with supporting technology, logistics services, and secure payment infrastructure for food products and related goods.",
                "These general terms and conditions apply to all buyers and sellers on the marketplace and govern your access to and use of RSS Foods and its related services.",
                "If you do not agree with any part of these terms, you must not use the platform.",
            ],
            bullets: [],
            note: "",
        },
        {
            id: "terms-account",
            title: "Account and Registration",
            paragraphs: [
                "You may not register on the marketplace if you are under 18 years old. By registering or using RSS Foods, you confirm that you are at least 18.",
                "You are responsible for maintaining the confidentiality of your account credentials and for all activities carried out through your account.",
            ],
            bullets: [
                "Keep your login credentials confidential.",
                "Notify us immediately if your password is compromised.",
                "Accept responsibility for activity carried out through your account.",
                "Use your account only for yourself because it is non-transferable.",
            ],
            note: "",
        },
        {
            id: "terms-sale",
            title: "Terms of Sale",
            paragraphs: [
                "By using the marketplace, you acknowledge that RSS Foods connects buyers and sellers and may not be the direct seller of every product listed.",
            ],
            bullets: [
                "Product listings and prices are the responsibility of the respective seller.",
                "Orders represent an offer to purchase, which the seller may accept or decline.",
                "Payment must be made using approved channels on the platform.",
                "Delivery timelines may vary depending on the order destination and seller readiness.",
            ],
            note: "",
        },
    ],
    closingTitle: "Binding Agreement",
    closingDescription: "By continuing to use our services, you confirm that you have read, understood, and agreed to these general terms and conditions.",
}

export const DEFAULT_PRIVACY_PAGE_CONTENT: DocumentPageContent = {
    badge: "Trust & Security",
    pageTitle: "Privacy & Data Protection Policy",
    introDescription: "RSS Foods is committed to safeguarding your personal information. This policy explains how we collect, use, store, and protect your data.",
    sections: [
        {
            id: "privacy-introduction",
            title: "Introduction",
            paragraphs: [
                "RSS Foods operates an ecommerce marketplace that includes a website and related digital services. This privacy policy explains how we collect, use, store, and protect personal information belonging to buyers, sellers, riders, and agents who use the platform.",
                "By accessing or using the marketplace, you accept these privacy terms. If you disagree with any part of them, you must not use the platform.",
            ],
            bullets: [],
            note: "",
        },
        {
            id: "privacy-collection",
            title: "Collection of Information",
            paragraphs: [
                "We collect personal information that is necessary to provide our services, process transactions, coordinate deliveries, and support customers.",
            ],
            bullets: [
                "Full name",
                "Email address",
                "Phone number",
                "Delivery or billing address",
                "Payment information",
                "Order history",
            ],
            note: "",
        },
        {
            id: "privacy-security",
            title: "Security Measures",
            paragraphs: [
                "We apply industry standard administrative, technical, and operational safeguards to protect your information from unauthorized access, misuse, loss, or destruction.",
                "We may share information only when it is required to fulfil orders, process payments, comply with legal obligations, or support core platform operations.",
            ],
            bullets: [],
            note: "We do not sell personal data to third parties.",
        },
    ],
    closingTitle: "Need Clarity on Privacy?",
    closingDescription: "If you have questions about your data or how it is handled on RSS Foods, contact the support team for clarification.",
}

function normalizeText(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeStringArray(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) {
        return fallback
    }

    const items = value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)

    return items.length > 0 ? items : fallback
}

function normalizeFaqItems(value: unknown): FaqPageItem[] {
    if (!Array.isArray(value)) {
        return DEFAULT_FAQ_PAGE_CONTENT.items
    }

    const items = value
        .map((entry, index) => {
            const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {}
            const fallback = DEFAULT_FAQ_PAGE_CONTENT.items[index] ?? DEFAULT_FAQ_PAGE_CONTENT.items[0]

            return {
                id: normalizeText(row.id, `faq-${index + 1}`),
                question: normalizeText(row.question, fallback.question),
                answer: normalizeText(row.answer, fallback.answer),
            }
        })
        .filter((item) => item.question && item.answer)

    return items.length > 0 ? items : DEFAULT_FAQ_PAGE_CONTENT.items
}

function normalizeDocumentSections(value: unknown, fallbackSections: DocumentPageSection[]) {
    if (!Array.isArray(value)) {
        return fallbackSections
    }

    const sections = value
        .map((entry, index) => {
            const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {}
            const fallback = fallbackSections[index] ?? fallbackSections[0]

            return {
                id: normalizeText(row.id, `section-${index + 1}`),
                title: normalizeText(row.title, fallback.title),
                paragraphs: normalizeStringArray(row.paragraphs, fallback.paragraphs),
                bullets: normalizeStringArray(row.bullets, []),
                note: typeof row.note === "string" ? row.note.trim() : fallback.note,
            }
        })
        .filter((section) => section.title && (section.paragraphs.length > 0 || section.bullets.length > 0 || section.note))

    return sections.length > 0 ? sections : fallbackSections
}

export function normalizeFaqPageContent(value: unknown): FaqPageContent {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {}

    return {
        pageTitle: normalizeText(row.page_title, DEFAULT_FAQ_PAGE_CONTENT.pageTitle),
        introDescription: normalizeText(row.intro_description, DEFAULT_FAQ_PAGE_CONTENT.introDescription),
        items: normalizeFaqItems(row.items),
    }
}

export function normalizeDocumentPageContent(value: unknown, fallback: DocumentPageContent): DocumentPageContent {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {}

    return {
        badge: normalizeText(row.badge, fallback.badge),
        pageTitle: normalizeText(row.page_title, fallback.pageTitle),
        introDescription: normalizeText(row.intro_description, fallback.introDescription),
        sections: normalizeDocumentSections(row.sections, fallback.sections),
        closingTitle: normalizeText(row.closing_title, fallback.closingTitle),
        closingDescription: normalizeText(row.closing_description, fallback.closingDescription),
    }
}
