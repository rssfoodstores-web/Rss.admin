import { AdminManagementClient } from "./AdminManagementClient"
import { getAdminManagementPageData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AdminsPage() {
    const data = await getAdminManagementPageData()

    return <AdminManagementClient initialData={data} />
}
