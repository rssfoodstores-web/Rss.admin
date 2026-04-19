import { Suspense } from "react"
import { getSafeNextPath } from "@/lib/auth-redirects"
import { AuthCallbackFallbackClient } from "./AuthCallbackFallbackClient"

export const dynamic = "force-dynamic"

interface AuthCallbackFallbackPageProps {
    searchParams: Promise<{
        code?: string
        next?: string
    }>
}

export default async function AuthCallbackFallbackPage({
    searchParams,
}: AuthCallbackFallbackPageProps) {
    const params = await searchParams
    const code = params.code?.trim() || null
    const nextPath = getSafeNextPath(params.next) ?? "/dashboard"

    return (
        <Suspense fallback={null}>
            <AuthCallbackFallbackClient code={code} nextPath={nextPath} />
        </Suspense>
    )
}
