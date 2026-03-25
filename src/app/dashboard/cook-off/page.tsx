import { CookOffAdminClient } from "./CookOffAdminClient"
import { getCookOffAdminData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminCookOffPage() {
    const data = await getCookOffAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cook-Off Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Control hero marketing slides, monthly sessions, participant reviews, and copy-ready contact lists.
                </p>
            </div>

            <CookOffAdminClient initialData={data} />
        </div>
    )
}
