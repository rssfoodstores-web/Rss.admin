const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
})

export function formatKobo(amountKobo: number | null | undefined): string {
    return NGN_FORMATTER.format((amountKobo ?? 0) / 100)
}

export function nairaToKobo(amountNaira: number): number {
    return Math.round(amountNaira * 100)
}

export function koboToNaira(amountKobo: number | null | undefined): number {
    return (amountKobo ?? 0) / 100
}
