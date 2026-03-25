import { createClient } from "@/lib/supabase/server";
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
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
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
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }

        console.error("OAuth code exchange failed:", error);

        return buildErrorRedirect(
            origin,
            error.message,
            "Session exchange failed in /auth/callback. Make sure this callback URL is allowlisted in Supabase Auth and that signin starts and ends on the same origin.",
            "session_exchange_failed"
        );
    }

    return buildErrorRedirect(
        origin,
        "Missing auth code",
        "Supabase did not return an authorization code."
    );
}
