import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { SocialMediaSettingsClient } from "./SocialMediaSettingsClient"

export default async function SocialMediaPage() {
    await requireAdminRoleAccess(["supa_admin"], "settings")

    return <SocialMediaSettingsClient />
}
