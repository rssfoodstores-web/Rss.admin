import { createClient } from "@/lib/supabase/server"
import {
    DEFAULT_WALLET_WITHDRAWAL_SETTINGS,
    normalizeWalletWithdrawalSettings,
    WALLET_WITHDRAWAL_SETTINGS_KEY,
} from "@/lib/wallet-withdrawal-settings"
import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { WalletWithdrawalSettingsClient } from "./WalletWithdrawalSettingsClient"

export default async function WalletWithdrawalsSettingsPage() {
    await requireAdminRoleAccess(["supa_admin"], "settings")

    const supabase = await createClient()
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", WALLET_WITHDRAWAL_SETTINGS_KEY)
        .maybeSingle()

    const initialSettings = normalizeWalletWithdrawalSettings(data?.value)

    return (
        <WalletWithdrawalSettingsClient
            initialSettings={initialSettings ?? DEFAULT_WALLET_WITHDRAWAL_SETTINGS}
        />
    )
}
