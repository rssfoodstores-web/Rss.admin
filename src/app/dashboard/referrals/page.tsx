import { ReferralAdminClient } from "./ReferralAdminClient"
import { getReferralAdminData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminReferralPage() {
    const data = await getReferralAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referral Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Adjust the live referral commission rate and monitor platform-wide referral performance.
                </p>
            </div>

            <ReferralAdminClient initialData={data} />
        </div>
    )
}
