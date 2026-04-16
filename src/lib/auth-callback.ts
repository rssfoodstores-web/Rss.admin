export function isPkceCodeVerifierMissingError(
    error: { message?: string | null; name?: string | null } | null | undefined
) {
    const message = error?.message ?? ""
    const name = error?.name ?? ""

    return name === "AuthPKCECodeVerifierMissingError"
        || message.toLowerCase().includes("pkce code verifier not found")
}
