import { WhatsAppCenterClient } from "./WhatsAppCenterClient"
import { getWhatsAppCenterPageData } from "./actions"

export const dynamic = "force-dynamic"

export default async function WhatsAppCenterPage() {
    const data = await getWhatsAppCenterPageData()
    return <WhatsAppCenterClient initialData={data} />
}
