import { PrivacyAdminClient } from "./PrivacyAdminClient"
import { getPrivacyAdminData } from "./actions"

export default async function AdminPrivacyPage() {
    const data = await getPrivacyAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy Page Management</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the data protection copy and sections shown on the public privacy policy page.
                </p>
            </div>

            <PrivacyAdminClient initialData={data} />
        </div>
    )
}
