import { getSafeNextPath } from "@/lib/auth-redirects";
import { getServerAdminSiteUrl } from "@/lib/site-url";
import { NextResponse } from "next/server";

function buildErrorRedirect(origin: string, message: string, description?: string | null, errorCode?: string | null) {
    const url = new URL("/auth/auth-code-error", origin);
    url.searchParams.set("error", message);
    url.searchParams.set("callback_url", `${origin}/auth/callback`);

    if (description) {
        url.searchParams.set("error_description", description);
    }

    if (errorCode) {
        url.searchParams.set("error_code", errorCode);
    }

    return NextResponse.redirect(url);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = getServerAdminSiteUrl(request);
    const code = searchParams.get("code");
    const next = getSafeNextPath(searchParams.get("next"));
    const oauthError = searchParams.get("error");
    const oauthErrorCode = searchParams.get("error_code");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
        console.error("OAuth provider returned an error:", {
            error: oauthError,
            errorCode: oauthErrorCode,
            description: oauthErrorDescription,
        });

        return buildErrorRedirect(origin, oauthError, oauthErrorDescription, oauthErrorCode);
    }

    if (code) {
        const fallbackUrl = new URL("/auth/callback-fallback", `${origin}/`)
        fallbackUrl.searchParams.set("code", code)

        if (next) {
            fallbackUrl.searchParams.set("next", next)
        }

        return NextResponse.redirect(fallbackUrl)
    }

    return buildErrorRedirect(
        origin,
        "Missing auth code",
        "Supabase did not return an authorization code."
    );
}
