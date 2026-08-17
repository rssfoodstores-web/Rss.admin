export const MANUAL_ACCOUNT_ROLES = [
    "customer",
    "merchant",
    "rider",
    "agent",
    "admin",
    "sub_admin",
] as const

export type ManualAccountRole = (typeof MANUAL_ACCOUNT_ROLES)[number]

export function isManualAccountRole(value: string): value is ManualAccountRole {
    return MANUAL_ACCOUNT_ROLES.includes(value as ManualAccountRole)
}
