export const WALLET_WITHDRAWAL_SETTINGS_KEY = "wallet_withdrawal_settings"

export type RoleWalletWithdrawalMode = "anytime" | "month_end_only"

export interface WalletWithdrawalSettings {
    roleWalletWithdrawalMode: RoleWalletWithdrawalMode
}

export const DEFAULT_WALLET_WITHDRAWAL_SETTINGS: WalletWithdrawalSettings = {
    roleWalletWithdrawalMode: "month_end_only",
}

export function normalizeWalletWithdrawalSettings(value: unknown): WalletWithdrawalSettings {
    if (!value || typeof value !== "object") {
        return DEFAULT_WALLET_WITHDRAWAL_SETTINGS
    }

    const raw = value as Record<string, unknown>

    return {
        roleWalletWithdrawalMode:
            raw.role_wallet_withdrawal_mode === "anytime"
                ? "anytime"
                : "month_end_only",
    }
}
