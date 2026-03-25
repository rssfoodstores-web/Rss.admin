export function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return "N/A"
    }

    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

export function formatPercentFromBps(bps: number | null | undefined): string {
    const percent = (bps ?? 0) / 100
    const hasFraction = percent % 1 !== 0

    return `${percent.toFixed(hasFraction ? 2 : 0)}%`
}

export function labelize(value: string | null | undefined): string {
    if (!value) {
        return "Unknown"
    }

    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}

export function shortId(value: string | null | undefined, length = 8): string {
    if (!value) {
        return "N/A"
    }

    return value.slice(0, length)
}

export function getOrderStatusClass(status: string | null | undefined): string {
    switch (status) {
        case "completed":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        case "delivered":
        case "out_for_delivery":
        case "ready_for_pickup":
            return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        case "awaiting_agent_acceptance":
        case "awaiting_merchant_confirmation":
        case "processing":
            return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
        case "disputed":
        case "refunded":
        case "cancelled":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    }
}

export function getPaymentStatusClass(status: string | null | undefined): string {
    switch (status) {
        case "paid":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        case "failed":
        case "refunded":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        default:
            return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
    }
}

export function getSettlementStatusClass(status: string | null | undefined): string {
    switch (status) {
        case "completed":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        case "failed":
        case "refunded":
        case "disputed":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    }
}
