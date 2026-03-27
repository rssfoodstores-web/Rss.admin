export const ADMIN_ROLE_PRIORITY = ["supa_admin", "admin", "sub_admin"] as const

export type AdminRole = (typeof ADMIN_ROLE_PRIORITY)[number]

export const ADMIN_ROUTE_DEFINITIONS = [
    {
        key: "dashboard",
        title: "Dashboard",
        href: "/dashboard",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "approvals",
        title: "Approvals",
        href: "/dashboard/approvals",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "orders",
        title: "Orders",
        href: "/dashboard/orders",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "notifications",
        title: "Notifications",
        href: "/dashboard/notifications",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "messages",
        title: "Messages",
        href: "/dashboard/messages",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "reports",
        title: "Finance",
        href: "/dashboard/reports",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "delivery_settings",
        title: "Delivery Settings",
        href: "/dashboard/delivery-settings",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "location_access",
        title: "Location Access",
        href: "/dashboard/location-access",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "ads",
        title: "Ads",
        href: "/dashboard/ads",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "referrals",
        title: "Referrals",
        href: "/dashboard/referrals",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "rewards",
        title: "Rewards",
        href: "/dashboard/rewards",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "cook_off",
        title: "Cook-Off",
        href: "/dashboard/cook-off",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "discount_bundles",
        title: "Bundle Deals",
        href: "/dashboard/discount-bundles",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "contact",
        title: "Contact Page",
        href: "/dashboard/contact",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "faqs",
        title: "FAQ Page",
        href: "/dashboard/faqs",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "terms",
        title: "Terms Page",
        href: "/dashboard/terms",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "privacy",
        title: "Privacy Page",
        href: "/dashboard/privacy",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "support",
        title: "Support Chat",
        href: "/dashboard/support",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "accounts",
        title: "Accounts",
        href: "/dashboard/accounts",
        assignableToSubAdmin: true,
        allowedRoles: ["supa_admin", "admin", "sub_admin"] as const,
    },
    {
        key: "admins",
        title: "Admins",
        href: "/dashboard/admins",
        assignableToSubAdmin: false,
        allowedRoles: ["supa_admin", "admin"] as const,
    },
    {
        key: "audit_logs",
        title: "Audit Logs",
        href: "/dashboard/audit-logs",
        assignableToSubAdmin: false,
        allowedRoles: ["supa_admin"] as const,
    },
    {
        key: "settings",
        title: "Settings",
        href: "/dashboard/settings",
        assignableToSubAdmin: false,
        allowedRoles: ["supa_admin"] as const,
    },
] as const

export type AdminRouteDefinition = (typeof ADMIN_ROUTE_DEFINITIONS)[number]
export type AdminRouteKey = AdminRouteDefinition["key"]

export interface AdminAccessSnapshot {
    allowedRouteKeys: AdminRouteKey[]
    assignedPermissionKeys: AdminRouteKey[]
    primaryRole: AdminRole
}

export function isAdminRole(value: string | null | undefined): value is AdminRole {
    return ADMIN_ROLE_PRIORITY.includes(value as AdminRole)
}

export function getAdminRouteDefinition(key: AdminRouteKey) {
    return ADMIN_ROUTE_DEFINITIONS.find((definition) => definition.key === key)
}

export function getAssignableAdminRoutes() {
    return ADMIN_ROUTE_DEFINITIONS.filter((definition) => definition.assignableToSubAdmin)
}

export function normalizeAssignablePermissionKeys(rawKeys: string[]) {
    const assignableKeys = new Set<string>(getAssignableAdminRoutes().map((definition) => definition.key))

    return Array.from(
        new Set(
            rawKeys.filter((key): key is AdminRouteKey => assignableKeys.has(key as AdminRouteKey))
        )
    )
}

export function getPrimaryAdminRole(roleNames: string[]) {
    for (const role of ADMIN_ROLE_PRIORITY) {
        if (roleNames.includes(role)) {
            return role
        }
    }

    return null
}

export function getAccessibleAdminRoutes(access: AdminAccessSnapshot) {
    return ADMIN_ROUTE_DEFINITIONS.filter((definition) => {
        if (!(definition.allowedRoles as readonly string[]).includes(access.primaryRole)) {
            return false
        }

        if (access.primaryRole !== "sub_admin") {
            return true
        }

        return definition.assignableToSubAdmin && access.assignedPermissionKeys.includes(definition.key)
    })
}

export function getDefaultAdminRouteHref(access: AdminAccessSnapshot) {
    const firstRoute = getAccessibleAdminRoutes(access)[0]
    return firstRoute?.href ?? "/dashboard/access-denied"
}

export function canAccessAdminRoute(access: AdminAccessSnapshot, key: AdminRouteKey) {
    return access.allowedRouteKeys.includes(key)
}
