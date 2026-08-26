export type ManualAccountIdentifierType = "email" | "phone"

export type ManualAccountPasswordSource = "generated" | "entered" | "unknown"

export interface ManualCreatedAccountRecord {
    accountConfirmed: boolean
    authUserExists: boolean
    avatarUrl: string | null
    createdAt: string
    createdByName: string
    createdByRole: string
    email: string | null
    fullName: string
    identifierType: ManualAccountIdentifierType
    lastSignInAt: string | null
    passwordSource: ManualAccountPasswordSource
    phone: string | null
    profileExists: boolean
    requestedRole: string
    roles: string[]
    userId: string
}
