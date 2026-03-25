"use client"

import { DocumentPageEditor } from "@/components/dashboard/content/document-page-editor"
import type { DocumentPageContent } from "@/lib/contentPages"
import { saveTermsPageContent } from "./actions"

interface TermsAdminClientProps {
    initialData: DocumentPageContent
}

export function TermsAdminClient({ initialData }: TermsAdminClientProps) {
    return (
        <DocumentPageEditor
            initialData={initialData}
            pageLabel="Terms page"
            publicPath="/terms"
            saveAction={saveTermsPageContent}
        />
    )
}
