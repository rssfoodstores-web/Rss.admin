const DEFAULT_ADMIN_SITE_URL = "https://rss-admin-sigma.vercel.app"

function normalizeSiteUrl(value: string | null | undefined) {
    if (!value) {
        return null
    }

    const normalized = value.trim().replace(/\/+$/, "")
    return normalized.length > 0 ? normalized : null
}

function isLocalHostName(hostname: string | null | undefined) {
    if (!hostname) {
        return false
    }

    return hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname === "0.0.0.0"
        || hostname.endsWith(".local")
}

export function getConfiguredAdminSiteUrl() {
    return normalizeSiteUrl(process.env.NEXT_PUBLIC_ADMIN_SITE_URL)
        ?? normalizeSiteUrl(process.env.ADMIN_SITE_URL)
        ?? normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
        ?? DEFAULT_ADMIN_SITE_URL
}

export function getClientAdminSiteUrl() {
    if (typeof window === "undefined") {
        return getConfiguredAdminSiteUrl()
    }

    // In the browser, we should always default to the current origin
    // to ensure OAuth state cookies are preserved on the same domain.
    return window.location.origin
}

export function getServerAdminSiteUrl(request?: Request) {
    const configuredSiteUrl = getConfiguredAdminSiteUrl()

    if (!request) {
        return configuredSiteUrl
    }

    const url = new URL(request.url)
    const forwardedHost = request.headers.get("x-forwarded-host")
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
    const host = forwardedHost ?? url.host
    const hostname = (forwardedHost ?? url.hostname).split(":")[0]

    if (isLocalHostName(hostname)) {
        return `${url.protocol}//${url.host}`
    }

    return configuredSiteUrl || `${forwardedProto}://${host}`
}

export function buildAbsoluteUrl(baseUrl: string, pathname: string, params?: Record<string, string | null | undefined>) {
    const url = new URL(pathname, `${baseUrl}/`)

    for (const [key, value] of Object.entries(params ?? {})) {
        const normalized = value?.trim()

        if (!normalized) {
            continue
        }

        url.searchParams.set(key, normalized)
    }

    return url.toString()
}
