import { getSupportAdminPageData } from "./actions"
import { SupportAdminClient } from "./SupportAdminClient"

export const dynamic = "force-dynamic"

export default async function AdminSupportPage() {
    const data = await getSupportAdminPageData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Chat Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Review contact-page chats, reply to customers, and control when Gemini is allowed to answer.
                </p>
            </div>

            <SupportAdminClient initialData={data} />
        </div>
    )
}
