import { TermsAdminClient } from "./TermsAdminClient"
import { getTermsAdminData } from "./actions"

export default async function AdminTermsPage() {
    const data = await getTermsAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Terms Page Management</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the legal copy and sections shown on the public terms and conditions page.
                </p>
            </div>

            <TermsAdminClient initialData={data} />
        </div>
    )
}
