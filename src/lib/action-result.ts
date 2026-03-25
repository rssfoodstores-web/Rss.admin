export function getActionError(result: unknown): string | null {
    if (typeof result !== "object" || result === null || !("error" in result)) {
        return null
    }

    const { error } = result as { error?: unknown }
    return typeof error === "string" && error.length > 0 ? error : null
}
