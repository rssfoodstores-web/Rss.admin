/** Read every row from a Supabase query without relying on the API's default row cap. */
export async function fetchAllPages<T>(
    fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    pageSize = 500
): Promise<T[]> {
    const rows: T[] = []

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await fetchPage(from, from + pageSize - 1)
        if (error) throw new Error(error.message)
        const page = data ?? []
        rows.push(...page)
        if (page.length < pageSize) return rows
    }
}
