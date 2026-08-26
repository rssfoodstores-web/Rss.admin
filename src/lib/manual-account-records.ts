import "server-only"

import type { User } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
    ManualAccountIdentifierType,
    ManualAccountPasswordSource,
    ManualCreatedAccountRecord,
} from "@/types/manual-accounts"

interface ManualAccountAuditRow {
    actor_id: string | null
    actor_role: string
    created_at: string
    entity_id: string | null
    metadata: unknown
}

interface ManualAccountProfileRow {
    avatar_url: string | null
    company_name: string | null
    full_name: string
    id: string
    phone: string | null
}

interface ManualAccountRoleRow {
    role: string
    user_id: string
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

function getText(record: Record<string, unknown>, key: string) {
    const value = record[key]
    return typeof value === "string" && value.trim() ? value.trim() : null
}

function getBoolean(record: Record<string, unknown>, key: string) {
    const value = record[key]
    return typeof value === "boolean" ? value : null
}

function getIdentifierType(
    metadata: Record<string, unknown>,
    appMetadata: Record<string, unknown>,
    authUser: User | undefined,
    profile: ManualAccountProfileRow | undefined
): ManualAccountIdentifierType {
    const storedType = getText(metadata, "identifier_type") ?? getText(appMetadata, "identifier_type")

    if (storedType === "phone" || storedType === "email") {
        return storedType
    }

    return authUser?.phone || profile?.phone ? "phone" : "email"
}

function getPasswordSource(
    metadata: Record<string, unknown>,
    appMetadata: Record<string, unknown>
): ManualAccountPasswordSource {
    const wasGenerated = getBoolean(metadata, "password_generated")
        ?? getBoolean(appMetadata, "password_generated")

    if (wasGenerated === true) return "generated"
    if (wasGenerated === false) return "entered"
    return "unknown"
}

async function listAllAuthUsers(adminSupabase: ReturnType<typeof createAdminClient>) {
    const users: User[] = []
    const perPage = 1000

    for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage })

        if (error) {
            throw new Error(`Could not load Auth users: ${error.message}`)
        }

        users.push(...data.users)

        if (data.users.length < perPage) {
            break
        }
    }

    return users
}

export async function getManualCreatedAccountRecords(): Promise<ManualCreatedAccountRecord[]> {
    const adminSupabase = createAdminClient()
    const [auditResult, authUsers] = await Promise.all([
        adminSupabase
            .from("audit_logs")
            .select("actor_id, actor_role, entity_id, metadata, created_at")
            .eq("action", "create_manual_account")
            .order("created_at", { ascending: false }),
        listAllAuthUsers(adminSupabase),
    ])

    if (auditResult.error) {
        throw new Error(`Could not load manual account audit records: ${auditResult.error.message}`)
    }

    const auditRows = (auditResult.data ?? []) as unknown as ManualAccountAuditRow[]
    const latestAuditByUserId = new Map<string, ManualAccountAuditRow>()

    for (const auditRow of auditRows) {
        if (auditRow.entity_id && !latestAuditByUserId.has(auditRow.entity_id)) {
            latestAuditByUserId.set(auditRow.entity_id, auditRow)
        }
    }

    const markedAuthUsers = authUsers.filter((user) => {
        const appMetadata = asRecord(user.app_metadata)
        return getText(appMetadata, "creation_method") === "admin_password_account"
    })
    const accountUserIds = new Set<string>([
        ...latestAuditByUserId.keys(),
        ...markedAuthUsers.map((user) => user.id),
    ])
    const actorIds = new Set(
        auditRows
            .map((auditRow) => auditRow.actor_id)
            .filter((actorId): actorId is string => Boolean(actorId))
    )
    const profileIds = Array.from(new Set([...accountUserIds, ...actorIds]))
    const manualUserIds = Array.from(accountUserIds)

    const [profilesResult, rolesResult] = await Promise.all([
        profileIds.length > 0
            ? adminSupabase
                .from("profiles")
                .select("id, full_name, phone, company_name, avatar_url")
                .in("id", profileIds)
            : Promise.resolve({ data: [], error: null }),
        manualUserIds.length > 0
            ? adminSupabase
                .from("user_roles")
                .select("user_id, role")
                .in("user_id", manualUserIds)
            : Promise.resolve({ data: [], error: null }),
    ])

    if (profilesResult.error || rolesResult.error) {
        throw new Error(
            profilesResult.error?.message
            ?? rolesResult.error?.message
            ?? "Could not load manual account details."
        )
    }

    const profiles = (profilesResult.data ?? []) as unknown as ManualAccountProfileRow[]
    const roleRows = (rolesResult.data ?? []) as unknown as ManualAccountRoleRow[]
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
    const authUserById = new Map(authUsers.map((user) => [user.id, user]))
    const rolesByUserId = new Map<string, string[]>()

    for (const roleRow of roleRows) {
        const roles = rolesByUserId.get(roleRow.user_id) ?? []
        roles.push(roleRow.role)
        rolesByUserId.set(roleRow.user_id, roles)
    }

    return manualUserIds
        .map((userId): ManualCreatedAccountRecord => {
            const auditRow = latestAuditByUserId.get(userId)
            const metadata = asRecord(auditRow?.metadata)
            const authUser = authUserById.get(userId)
            const appMetadata = asRecord(authUser?.app_metadata)
            const userMetadata = asRecord(authUser?.user_metadata)
            const profile = profileById.get(userId)
            const actorProfile = auditRow?.actor_id ? profileById.get(auditRow.actor_id) : undefined
            const identifierType = getIdentifierType(metadata, appMetadata, authUser, profile)
            const requestedRole = getText(metadata, "role")
                ?? getText(appMetadata, "created_role")
                ?? rolesByUserId.get(userId)?.[0]
                ?? "customer"
            const fullName = profile?.full_name
                ?? getText(metadata, "full_name")
                ?? getText(userMetadata, "full_name")
                ?? authUser?.email?.split("@")[0]
                ?? authUser?.phone
                ?? "Unnamed account"

            return {
                accountConfirmed: identifierType === "phone"
                    ? Boolean(authUser?.phone_confirmed_at)
                    : Boolean(authUser?.email_confirmed_at),
                authUserExists: Boolean(authUser),
                avatarUrl: profile?.avatar_url ?? null,
                createdAt: auditRow?.created_at ?? authUser?.created_at ?? new Date(0).toISOString(),
                createdByName: actorProfile?.full_name
                    ?? actorProfile?.company_name
                    ?? "Administrator",
                createdByRole: auditRow?.actor_role ?? "admin",
                email: authUser?.email ?? getText(metadata, "email"),
                fullName,
                identifierType,
                lastSignInAt: authUser?.last_sign_in_at ?? null,
                passwordSource: getPasswordSource(metadata, appMetadata),
                phone: authUser?.phone ?? profile?.phone ?? getText(metadata, "phone"),
                profileExists: Boolean(profile),
                requestedRole,
                roles: Array.from(new Set(rolesByUserId.get(userId) ?? [])).sort(),
                userId,
            }
        })
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}
