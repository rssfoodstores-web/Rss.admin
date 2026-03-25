import { DiscountBundlesAdminClient } from "./DiscountBundlesAdminClient"
import { getDiscountBundlesAdminData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminDiscountBundlesPage() {
    const data = await getDiscountBundlesAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discount Bundle Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Manage the discount-bundle landing page, campaign bundles, and hero-ready marketing assets.
                </p>
            </div>

            <DiscountBundlesAdminClient initialData={data} />
        </div>
    )
}
