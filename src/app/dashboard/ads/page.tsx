import { getAdsDashboard } from "@/actions/ads"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { AdsDashboardClient } from "./AdsDashboardClient"

export default async function AdsPage() {
    await requireAdminRouteAccess("ads")
    const data = await getAdsDashboard()

    return <AdsDashboardClient initialData={data} />
}
