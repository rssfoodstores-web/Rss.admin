import { getRewardAdminData } from "./actions"
import { RewardAdminClient } from "./RewardAdminClient"

export const dynamic = "force-dynamic"

export default async function AdminRewardsPage() {
    const data = await getRewardAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reward Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Control the live loyalty settings, pause the system when needed, and monitor issuance, redemption, and expiry.
                </p>
            </div>

            <RewardAdminClient initialData={data} />
        </div>
    )
}
