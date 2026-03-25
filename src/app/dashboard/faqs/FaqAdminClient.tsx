"use client"

import { FaqPageEditor } from "@/components/dashboard/content/faq-page-editor"
import type { FaqPageContent } from "@/lib/contentPages"
import { saveFaqPageContent } from "./actions"

interface FaqAdminClientProps {
    initialData: FaqPageContent
}

export function FaqAdminClient({ initialData }: FaqAdminClientProps) {
    return (
        <FaqPageEditor
            initialData={initialData}
            pageLabel="FAQ page"
            publicPath="/faqs"
            saveAction={saveFaqPageContent}
        />
    )
}
