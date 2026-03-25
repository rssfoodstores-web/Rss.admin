import { FaqAdminClient } from "./FaqAdminClient"
import { getFaqAdminData } from "./actions"

export default async function AdminFaqPage() {
    const data = await getFaqAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FAQ Page Management</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Edit the questions and answers customers see on the public FAQ page.
                </p>
            </div>

            <FaqAdminClient initialData={data} />
        </div>
    )
}
