"use client"

import { DocumentPageEditor } from "@/components/dashboard/content/document-page-editor"
import type { DocumentPageContent } from "@/lib/contentPages"
import { savePrivacyPageContent } from "./actions"

interface PrivacyAdminClientProps {
    initialData: DocumentPageContent
}

export function PrivacyAdminClient({ initialData }: PrivacyAdminClientProps) {
    return (
        <DocumentPageEditor
            initialData={initialData}
            pageLabel="Privacy page"
            publicPath="/privacy"
            saveAction={savePrivacyPageContent}
        />
    )
}
