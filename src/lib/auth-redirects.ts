export function getSafeNextPath(nextPath: string | null | undefined) {
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return null
    }

    return nextPath
}
