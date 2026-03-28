import { HeroSectionAdminClient } from "./HeroSectionAdminClient"
import { getStorefrontHeroAdminData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminHeroSectionPage() {
    const data = await getStorefrontHeroAdminData()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hero Section Management</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Control the storefront hero banner for the homepage, retail, and wholesale routes from one dedicated page.
                </p>
            </div>

            <HeroSectionAdminClient initialData={data} />
        </div>
    )
}
