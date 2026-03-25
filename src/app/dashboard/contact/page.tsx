import { ContactAdminClient } from "./ContactAdminClient"
import { getContactAdminData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminContactPage() {
    const data = await getContactAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Page Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Edit the public contact page copy and control which contact methods appear to customers.
                </p>
            </div>

            <ContactAdminClient initialData={data} />
        </div>
    )
}
