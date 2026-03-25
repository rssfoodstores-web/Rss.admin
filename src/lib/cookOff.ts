import type { Tables } from "@/types/database.types"

export const COOK_OFF_ADMIN_WEIGHT = 0.6
export const COOK_OFF_PUBLIC_WEIGHT = 0.4

export type CookOffSessionRow = Tables<"cook_off_sessions">
export type CookOffEntryRow = Tables<"cook_off_entries">
export type CookOffScoreboardRow = Tables<"cook_off_entry_scoreboard">

export interface CookOffRankableEntry {
    entryId: string
    voteCount: number
    adminScore: number | null
    createdAt: string | null
}

export interface CookOffComputedMetrics {
    publicVoteScore: number
    finalScore: number
    rank: number
}

export interface CookOffRankedEntry extends CookOffComputedMetrics {
    adminCreativityScore: number | null
    adminFeedback: string | null
    adminPresentationScore: number | null
    adminScore: number | null
    cookingProcessVideoUrl: string | null
    createdAt: string | null
    entryCode: string
    entryId: string
    isFeatured: boolean
    presentationVideoUrl: string | null
    recipeName: string
    sessionId: string
    submitterEmail: string | null
    submitterName: string
    submitterPhone: string | null
    userId: string
    voteCount: number
    winnerPosition: number | null
}

function roundScore(value: number) {
    return Math.round(value * 100) / 100
}

export function computeCookOffPublicVoteScore(voteCount: number, maxVotes: number) {
    if (maxVotes <= 0) {
        return 0
    }

    return roundScore((voteCount / maxVotes) * 100)
}

export function computeCookOffFinalScore(adminScore: number | null, voteCount: number, maxVotes: number) {
    const normalizedAdminScore = adminScore ?? 0
    const publicVoteScore = computeCookOffPublicVoteScore(voteCount, maxVotes)

    return {
        publicVoteScore,
        finalScore: roundScore((normalizedAdminScore * COOK_OFF_ADMIN_WEIGHT) + (publicVoteScore * COOK_OFF_PUBLIC_WEIGHT)),
    }
}

export function rankCookOffEntries<T extends CookOffRankableEntry>(entries: T[]) {
    const maxVotes = entries.reduce((highest, entry) => Math.max(highest, entry.voteCount), 0)

    const scoredEntries = entries.map((entry) => {
        const { publicVoteScore, finalScore } = computeCookOffFinalScore(entry.adminScore, entry.voteCount, maxVotes)

        return {
            ...entry,
            publicVoteScore,
            finalScore,
        }
    })

    scoredEntries.sort((left, right) => {
        if (right.finalScore !== left.finalScore) {
            return right.finalScore - left.finalScore
        }

        const leftAdmin = left.adminScore ?? 0
        const rightAdmin = right.adminScore ?? 0
        if (rightAdmin !== leftAdmin) {
            return rightAdmin - leftAdmin
        }

        if (right.voteCount !== left.voteCount) {
            return right.voteCount - left.voteCount
        }

        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
    })

    let previousRank = 0
    let previousKey = ""

    return scoredEntries.map((entry, index) => {
        const rankingKey = `${entry.finalScore}:${entry.adminScore ?? 0}:${entry.voteCount}`
        const rank = rankingKey === previousKey ? previousRank : index + 1

        previousKey = rankingKey
        previousRank = rank

        return {
            ...entry,
            rank,
        } satisfies T & CookOffComputedMetrics
    })
}

export function toCookOffRankedEntries(rows: CookOffScoreboardRow[]) {
    return rankCookOffEntries(
        rows
            .filter((row): row is NonNullable<typeof row> & {
                entry_id: string
                session_id: string
                user_id: string
                entry_code: string
                recipe_name: string
                submitter_name: string
            } =>
                Boolean(
                    row.entry_id &&
                    row.session_id &&
                    row.user_id &&
                    row.entry_code &&
                    row.recipe_name &&
                    row.submitter_name
                )
            )
            .map((row) => ({
                adminCreativityScore: row.admin_creativity_score ?? null,
                adminFeedback: row.admin_feedback ?? null,
                adminPresentationScore: row.admin_presentation_score ?? null,
                adminScore: row.admin_score ?? null,
                cookingProcessVideoUrl: row.cooking_process_video_url ?? null,
                createdAt: row.created_at ?? null,
                entryCode: row.entry_code,
                entryId: row.entry_id,
                isFeatured: row.is_featured ?? false,
                presentationVideoUrl: row.presentation_video_url ?? null,
                recipeName: row.recipe_name,
                sessionId: row.session_id,
                submitterEmail: row.submitter_email ?? null,
                submitterName: row.submitter_name,
                submitterPhone: row.submitter_phone ?? null,
                userId: row.user_id,
                voteCount: row.vote_count ?? 0,
                winnerPosition: row.winner_position ?? null,
            }))
    ) satisfies CookOffRankedEntry[]
}

export function groupCookOffRankingsBySession(rows: CookOffScoreboardRow[]) {
    const grouped = new Map<string, CookOffScoreboardRow[]>()

    for (const row of rows) {
        if (!row.session_id) {
            continue
        }

        const items = grouped.get(row.session_id) ?? []
        items.push(row)
        grouped.set(row.session_id, items)
    }

    return new Map(
        Array.from(grouped.entries()).map(([sessionId, sessionRows]) => [
            sessionId,
            toCookOffRankedEntries(sessionRows),
        ])
    )
}

export function formatCookOffEntryStatus(status: string) {
    switch (status) {
        case "approved":
            return "Approved"
        case "rejected":
            return "Rejected"
        case "pending":
        default:
            return "Pending review"
    }
}

export function formatCookOffSessionStatus(status: string) {
    switch (status) {
        case "active":
            return "Active"
        case "archived":
            return "Archived"
        case "draft":
        default:
            return "Draft"
    }
}
