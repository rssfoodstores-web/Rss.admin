import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, formatPercentFromBps, labelize, shortId } from "@/lib/admin-display"
import { formatKobo } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Wallet,
    Lock,
    TrendingUp,
    Receipt,
    Store,
    RotateCcw,
    CheckCircle2,
    Download,
    CalendarRange,
    ArrowUpRight,
    Building2,
    Truck,
    Percent,
    Layers,
    FileText,
    Ban,
} from "lucide-react"

type CorporateWalletRow = {
    id: string
    wallet_key: string
    wallet_name: string
    available_balance_kobo: number
    locked_balance_kobo: number
    updated_at: string
}

type LedgerRow = {
    id: string
    category: string
    amount_kobo: number
    reference_type: string | null
    reference_id: string | null
    description: string | null
    created_at: string
}

type TaxRow = {
    id: string
    order_id: string
    taxable_base_kobo: number
    vat_amount_kobo: number
    vat_bps: number
    status: string
    created_at: string
}

type RefundRow = {
    id: string
    order_id: string
    amount_kobo: number
    status: string
    reason: string
    created_at: string
}

type OrderFinancialDetailRow = {
    order_id: string
    merchant_base_total_kobo: number
    agent_fee_total_kobo: number
    app_fee_total_kobo: number
    ops_fee_total_kobo: number
    insurance_total_kobo: number
    vat_total_kobo: number
    delivery_total_kobo: number
    rider_share_kobo: number
    corporate_delivery_share_kobo: number
    grand_total_kobo: number
    settlement_status: string
    settled_at: string | null
    created_at: string
}

type OrderMetaRow = {
    id: string
    customer_id: string
    merchant_id: string | null
    status: string
    payment_ref: string | null
    created_at: string
}

type ProfileRow = {
    id: string
    full_name: string | null
    company_name: string | null
}

interface PageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getCorporateRevenueKobo(financial: OrderFinancialDetailRow) {
    return (
        financial.app_fee_total_kobo +
        financial.ops_fee_total_kobo +
        financial.insurance_total_kobo +
        financial.corporate_delivery_share_kobo
    )
}

function inDateRange(value: string | null | undefined, from: string, to: string) {
    if (!value) {
        return !from && !to
    }

    const current = new Date(value)
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null

    if (fromDate && current < fromDate) {
        return false
    }

    if (toDate && current > toDate) {
        return false
    }

    return true
}

/* ─── Stat card icon wrappers with brand-consistent gradient accents ─── */
const statCardConfigs = [
    { key: "balance", icon: Wallet, gradient: "from-emerald-500/15 to-emerald-600/5", iconColor: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
    { key: "locked", icon: Lock, gradient: "from-amber-500/15 to-amber-600/5", iconColor: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
    { key: "revenue", icon: TrendingUp, gradient: "from-blue-500/15 to-blue-600/5", iconColor: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
    { key: "vat", icon: Receipt, gradient: "from-violet-500/15 to-violet-600/5", iconColor: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20" },
    { key: "merchant", icon: Store, gradient: "from-orange-500/15 to-orange-600/5", iconColor: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20" },
    { key: "refund", icon: RotateCcw, gradient: "from-rose-500/15 to-rose-600/5", iconColor: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20" },
    { key: "settled", icon: CheckCircle2, gradient: "from-teal-500/15 to-teal-600/5", iconColor: "text-teal-600 dark:text-teal-400", ring: "ring-teal-500/20" },
] as const

function StatBadge({ status }: { status: string }) {
    const s = status.toLowerCase()
    const color =
        s === "completed" || s === "processed" || s === "logged"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
            : s === "pending"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                : s === "failed" || s === "rejected"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    : "bg-secondary text-secondary-foreground border-border"
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color} transition-colors`}>
            {labelize(status)}
        </span>
    )
}

export default async function ReportsPage({ searchParams }: PageProps) {
    await requireAdminRouteAccess("reports")
    const params = await searchParams
    const from = typeof params.from === "string" ? params.from : ""
    const to = typeof params.to === "string" ? params.to : ""
    const supabase = await createClient()

    let taxQuery = supabase
        .from("tax_liabilities")
        .select("id, order_id, taxable_base_kobo, vat_amount_kobo, vat_bps, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200)

    if (from) {
        taxQuery = taxQuery.gte("created_at", `${from}T00:00:00.000Z`)
    }

    if (to) {
        taxQuery = taxQuery.lte("created_at", `${to}T23:59:59.999Z`)
    }

    const [walletResult, ledgerResult, taxResult, refundResult, settingsResult, financialResult] = await Promise.all([
        supabase
            .from("corporate_wallets")
            .select("id, wallet_key, wallet_name, available_balance_kobo, locked_balance_kobo, updated_at")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("corporate_ledger_entries")
            .select("id, category, amount_kobo, reference_type, reference_id, description, created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        taxQuery,
        supabase
            .from("refunds")
            .select("id, order_id, amount_kobo, status, reason, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("app_settings")
            .select("key, value")
            .in("key", ["delivery_settings", "platform_financial_settings"]),
        supabase
            .from("order_financials")
            .select("order_id, merchant_base_total_kobo, agent_fee_total_kobo, app_fee_total_kobo, ops_fee_total_kobo, insurance_total_kobo, vat_total_kobo, delivery_total_kobo, rider_share_kobo, corporate_delivery_share_kobo, grand_total_kobo, settlement_status, settled_at, created_at")
            .order("created_at", { ascending: false })
            .limit(250),
    ])

    const wallet = (walletResult.data ?? null) as CorporateWalletRow | null
    const ledgerEntries = ((ledgerResult.data ?? []) as LedgerRow[]).filter((entry) => inDateRange(entry.created_at, from, to))
    const taxRows = (taxResult.data ?? []) as TaxRow[]
    const refunds = ((refundResult.data ?? []) as RefundRow[]).filter((refund) => inDateRange(refund.created_at, from, to))
    const settings = (settingsResult.data ?? []) as Array<{ key: string, value: Record<string, number> }>
    const rawFinancialRows = (financialResult.data ?? []) as OrderFinancialDetailRow[]
    const financialRows = rawFinancialRows
        .filter((financial) => inDateRange(financial.settled_at ?? financial.created_at, from, to))
        .sort((a, b) => new Date(b.settled_at ?? b.created_at).getTime() - new Date(a.settled_at ?? a.created_at).getTime())

    const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]))
    const deliverySettings = settingsMap.get("delivery_settings") ?? {}
    const platformSettings = settingsMap.get("platform_financial_settings") ?? {}

    const vatTotalKobo = taxRows.reduce((sum, row) => sum + row.vat_amount_kobo, 0)
    const taxableBaseKobo = taxRows.reduce((sum, row) => sum + row.taxable_base_kobo, 0)
    const creditedLedgerKobo = ledgerEntries.filter((entry) => entry.amount_kobo > 0).reduce((sum, entry) => sum + entry.amount_kobo, 0)
    const refundedKobo = refunds
        .filter((refund) => refund.status === "processed")
        .reduce((sum, refund) => sum + refund.amount_kobo, 0)
    const settledFinancialRows = financialRows.filter((financial) => financial.settlement_status === "completed")
    const corporateRevenueKobo = settledFinancialRows.reduce((sum, financial) => sum + getCorporateRevenueKobo(financial), 0)
    const merchantPayoutKobo = settledFinancialRows.reduce((sum, financial) => sum + financial.merchant_base_total_kobo, 0)
    const agentPayoutKobo = settledFinancialRows.reduce((sum, financial) => sum + financial.agent_fee_total_kobo, 0)
    const riderPayoutKobo = settledFinancialRows.reduce((sum, financial) => sum + financial.rider_share_kobo, 0)
    const unsettledRevenueKobo = financialRows
        .filter((financial) => financial.settlement_status !== "completed")
        .reduce((sum, financial) => sum + getCorporateRevenueKobo(financial), 0)
    const ledgerCategoryTotals = ledgerEntries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.category] = (acc[entry.category] ?? 0) + entry.amount_kobo
        return acc
    }, {})

    const financeOrderIds = Array.from(new Set([
        ...financialRows.map((financial) => financial.order_id),
        ...taxRows.map((tax) => tax.order_id),
        ...refunds.map((refund) => refund.order_id),
    ]))

    const { data: orderRowsData } = financeOrderIds.length > 0
        ? await supabase
            .from("orders")
            .select("id, customer_id, merchant_id, status, payment_ref, created_at")
            .in("id", financeOrderIds)
        : { data: [] }

    const orderRows = (orderRowsData ?? []) as OrderMetaRow[]
    const orderMap = new Map(orderRows.map((order) => [order.id, order]))

    const profileIds = Array.from(new Set(
        orderRows.flatMap((order) => [order.customer_id, order.merchant_id].filter(Boolean) as string[])
    ))

    const { data: profileRowsData } = profileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, company_name")
            .in("id", profileIds)
        : { data: [] }

    const profileRows = (profileRowsData ?? []) as ProfileRow[]
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]))

    const csvHref = `/api/reports/vat${from || to ? `?${new URLSearchParams(Object.entries({ from, to }).filter(([, value]) => value)).toString()}` : ""}`

    /* ─── Stat cards data ─── */
    const stats = [
        { key: "balance", title: "Corporate Balance", value: formatKobo(wallet?.available_balance_kobo ?? 0), sub: null },
        { key: "locked", title: "Locked Balance", value: formatKobo(wallet?.locked_balance_kobo ?? 0), sub: null },
        { key: "revenue", title: "Company Revenue", value: formatKobo(corporateRevenueKobo), sub: `Unsettled ${formatKobo(unsettledRevenueKobo)}` },
        { key: "vat", title: "VAT Logged", value: formatKobo(vatTotalKobo), sub: `Taxable base ${formatKobo(taxableBaseKobo)}` },
        { key: "merchant", title: "Merchant Payouts", value: formatKobo(merchantPayoutKobo), sub: `Agent ${formatKobo(agentPayoutKobo)} · Rider ${formatKobo(riderPayoutKobo)}` },
        { key: "refund", title: "Refunded Outflow", value: formatKobo(refundedKobo), sub: `Ledger inflow ${formatKobo(creditedLedgerKobo)}` },
        { key: "settled", title: "Settled Orders", value: String(settledFinancialRows.length), sub: null },
    ]

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            {/* ─── Page Header ─── */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Company Wallet & Finance</h1>
                        <p className="text-sm text-muted-foreground">
                            Wallet visibility, per-order revenue, VAT tracking, refunds &amp; exportable reporting.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── KPI Stat Cards ─── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
                {stats.map((stat) => {
                    const cfg = statCardConfigs.find((c) => c.key === stat.key)!
                    const Icon = cfg.icon
                    return (
                        <Card
                            key={stat.key}
                            className={`glass-card group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${stat.key === "settled" ? "col-span-2 lg:col-span-1" : ""}`}
                        >
                            {/* Subtle gradient bg */}
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-60`} />
                            <CardHeader className="relative flex flex-row items-center gap-3 space-y-0 pb-1 pt-4 px-4">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${cfg.ring} bg-background/50`}>
                                    <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                                </div>
                                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">
                                    {stat.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative px-4 pb-4 pt-1">
                                <div className="text-xl sm:text-2xl font-bold tracking-tight">{stat.value}</div>
                                {stat.sub && (
                                    <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground/80 leading-tight">{stat.sub}</p>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* ─── Wallet Details + VAT Export ─── */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Corporate Wallet Card */}
                <Card className="glass-card">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            <CardTitle>Corporate Wallet</CardTitle>
                        </div>
                        <CardDescription>
                            Primary wallet <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{wallet?.wallet_key ?? "rss_primary"}</code>{" "}
                            updated {formatDateTime(wallet?.updated_at ?? null)}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                        {/* Wallet Health */}
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-emerald-500/5 to-transparent p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                                Wallet Health
                            </div>
                            <div className="font-semibold">{formatKobo(wallet?.available_balance_kobo ?? 0)}</div>
                            <div className="text-xs text-muted-foreground">Reserved VAT {formatKobo(wallet?.locked_balance_kobo ?? 0)}</div>
                        </div>

                        {/* Ledger Categories */}
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-500/5 to-transparent p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Layers className="h-3.5 w-3.5 text-blue-500" />
                                Ledger Categories
                            </div>
                            <div className="space-y-1.5 text-sm">
                                {Object.entries(ledgerCategoryTotals).length === 0 ? (
                                    <div className="text-xs text-muted-foreground/70 italic">No entries this range.</div>
                                ) : (
                                    Object.entries(ledgerCategoryTotals).map(([category, amount]) => (
                                        <div key={category} className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-muted-foreground">{labelize(category)}</span>
                                            <span className="text-xs font-semibold">{formatKobo(amount)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Delivery Split */}
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-orange-500/5 to-transparent p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Truck className="h-3.5 w-3.5 text-orange-500" />
                                Delivery Split
                            </div>
                            <div className="text-sm font-semibold">
                                Rider {formatPercentFromBps(Number(deliverySettings.rider_share_bps ?? 8000))} · Corporate {formatPercentFromBps(Number(deliverySettings.corporate_delivery_share_bps ?? 2000))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Base {formatKobo(Number(deliverySettings.base_fare_kobo ?? 0))} · {formatKobo(Number(deliverySettings.distance_rate_kobo_per_km ?? 0))}/km
                            </div>
                        </div>

                        {/* Platform Fees */}
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-violet-500/5 to-transparent p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Percent className="h-3.5 w-3.5 text-violet-500" />
                                Platform Fees
                            </div>
                            <div className="text-sm font-semibold">
                                Agent {formatPercentFromBps(Number(platformSettings.agent_fee_bps ?? 200))} · App {formatPercentFromBps(Number(platformSettings.app_fee_bps ?? 1000))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Ops {formatPercentFromBps(Number(platformSettings.ops_fee_bps ?? 200))} · VAT {formatPercentFromBps(Number(platformSettings.vat_bps ?? 750))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* VAT Export Card */}
                <Card className="glass-card">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <CardTitle>VAT Export</CardTitle>
                        </div>
                        <CardDescription>Filter tax liabilities by date range and export as CSV.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-col gap-4" method="get">
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <CalendarRange className="h-3.5 w-3.5" />
                                        From Date
                                    </label>
                                    <Input type="date" name="from" defaultValue={from} className="bg-background/50" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <CalendarRange className="h-3.5 w-3.5" />
                                        To Date
                                    </label>
                                    <Input type="date" name="to" defaultValue={to} className="bg-background/50" />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button type="submit" variant="outline" className="flex-1 sm:flex-initial gap-2">
                                    <ArrowUpRight className="h-4 w-4" />
                                    Apply Filter
                                </Button>
                                <Button asChild className="flex-1 sm:flex-initial gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                                    <Link href={csvHref}>
                                        <Download className="h-4 w-4" />
                                        Export CSV
                                    </Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Per-Order Revenue Breakdown ─── */}
            <Card className="glass-card">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                <CardTitle>Per-Order Revenue Breakdown</CardTitle>
                            </div>
                            <CardDescription className="mt-1">
                                Company revenue = app fee + ops fee + insurance + corporate delivery share.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="w-fit text-xs">
                            {financialRows.length} order{financialRows.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {financialRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Ban className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No order financials match the current filter.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block overflow-x-auto rounded-lg border border-border/50">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="font-semibold">Order</TableHead>
                                            <TableHead className="font-semibold">Merchant</TableHead>
                                            <TableHead className="font-semibold">Gross</TableHead>
                                            <TableHead className="font-semibold">Revenue</TableHead>
                                            <TableHead className="font-semibold">VAT</TableHead>
                                            <TableHead className="font-semibold">Payouts</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="text-right font-semibold">Settled</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {financialRows.map((financial) => {
                                            const order = orderMap.get(financial.order_id)
                                            const merchant = order?.merchant_id ? profileMap.get(order.merchant_id) : null
                                            return (
                                                <TableRow key={financial.order_id} className="group hover:bg-muted/20">
                                                    <TableCell>
                                                        <div className="font-medium">#{shortId(financial.order_id, 10)}</div>
                                                        <div className="text-xs text-muted-foreground">{order?.payment_ref ?? "No ref"}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{merchant?.company_name ?? merchant?.full_name ?? "Unknown"}</div>
                                                        <div className="text-xs text-muted-foreground">{labelize(order?.status ?? "unknown")}</div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{formatKobo(financial.grand_total_kobo)}</TableCell>
                                                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKobo(getCorporateRevenueKobo(financial))}</TableCell>
                                                    <TableCell>{formatKobo(financial.vat_total_kobo)}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        <span>M: {formatKobo(financial.merchant_base_total_kobo)}</span>
                                                        <br />
                                                        <span>A: {formatKobo(financial.agent_fee_total_kobo)} · R: {formatKobo(financial.rider_share_kobo)}</span>
                                                    </TableCell>
                                                    <TableCell><StatBadge status={financial.settlement_status} /></TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {formatDateTime(financial.settled_at ?? financial.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile card view */}
                            <div className="lg:hidden space-y-3">
                                {financialRows.map((financial) => {
                                    const order = orderMap.get(financial.order_id)
                                    const merchant = order?.merchant_id ? profileMap.get(order.merchant_id) : null
                                    return (
                                        <div key={financial.order_id} className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-semibold text-sm">#{shortId(financial.order_id, 10)}</div>
                                                    <div className="text-xs text-muted-foreground">{merchant?.company_name ?? merchant?.full_name ?? "Unknown"}</div>
                                                </div>
                                                <StatBadge status={financial.settlement_status} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div>
                                                    <div className="text-xs text-muted-foreground">Gross</div>
                                                    <div className="font-medium">{formatKobo(financial.grand_total_kobo)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-muted-foreground">Revenue</div>
                                                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKobo(getCorporateRevenueKobo(financial))}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-muted-foreground">VAT</div>
                                                    <div className="font-medium">{formatKobo(financial.vat_total_kobo)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-muted-foreground">Merchant</div>
                                                    <div className="font-medium">{formatKobo(financial.merchant_base_total_kobo)}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground border-t border-border/30 pt-2">
                                                {formatDateTime(financial.settled_at ?? financial.created_at)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ─── VAT Liabilities + Corporate Ledger ─── */}
            <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
                {/* VAT Liabilities */}
                <Card className="glass-card">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            <CardTitle>VAT Liabilities</CardTitle>
                        </div>
                        <CardDescription>One row per completed order settlement.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {taxRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Ban className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No VAT liabilities match the current filter.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop */}
                                <div className="hidden md:block overflow-x-auto rounded-lg border border-border/50">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableHead className="font-semibold">Order</TableHead>
                                                <TableHead className="font-semibold">Tax Base</TableHead>
                                                <TableHead className="font-semibold">VAT</TableHead>
                                                <TableHead className="font-semibold">Status</TableHead>
                                                <TableHead className="text-right font-semibold">Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {taxRows.map((tax) => (
                                                <TableRow key={tax.id} className="hover:bg-muted/20">
                                                    <TableCell className="font-medium">#{shortId(tax.order_id, 10)}</TableCell>
                                                    <TableCell>{formatKobo(tax.taxable_base_kobo)}</TableCell>
                                                    <TableCell className="font-semibold">{formatKobo(tax.vat_amount_kobo)}</TableCell>
                                                    <TableCell><StatBadge status={tax.status} /></TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {formatDateTime(tax.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile */}
                                <div className="md:hidden space-y-3">
                                    {taxRows.map((tax) => (
                                        <div key={tax.id} className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">#{shortId(tax.order_id, 10)}</span>
                                                <StatBadge status={tax.status} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <div className="text-xs text-muted-foreground">Tax Base</div>
                                                    <div className="font-medium">{formatKobo(tax.taxable_base_kobo)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-muted-foreground">VAT</div>
                                                    <div className="font-semibold">{formatKobo(tax.vat_amount_kobo)}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                                                {formatDateTime(tax.created_at)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Corporate Ledger */}
                <Card className="glass-card">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-primary" />
                            <CardTitle>Corporate Ledger</CardTitle>
                        </div>
                        <CardDescription>Append-only corporate ledger entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {ledgerEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Ban className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No corporate ledger entries have been recorded yet.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop */}
                                <div className="hidden md:block overflow-x-auto rounded-lg border border-border/50">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableHead className="font-semibold">Category</TableHead>
                                                <TableHead className="font-semibold">Amount</TableHead>
                                                <TableHead className="font-semibold">Reference</TableHead>
                                                <TableHead className="text-right font-semibold">Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {ledgerEntries.map((entry) => (
                                                <TableRow key={entry.id} className="hover:bg-muted/20">
                                                    <TableCell>
                                                        <div className="font-medium">{labelize(entry.category)}</div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {entry.description || "No description"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={`font-semibold ${entry.amount_kobo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                        {entry.amount_kobo >= 0 ? "+" : ""}{formatKobo(entry.amount_kobo)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {entry.reference_type ? `${labelize(entry.reference_type)} · ${shortId(entry.reference_id, 10)}` : "N/A"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {formatDateTime(entry.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile */}
                                <div className="md:hidden space-y-3">
                                    {ledgerEntries.map((entry) => (
                                        <div key={entry.id} className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">{labelize(entry.category)}</span>
                                                <span className={`font-bold text-sm ${entry.amount_kobo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                    {entry.amount_kobo >= 0 ? "+" : ""}{formatKobo(entry.amount_kobo)}
                                                </span>
                                            </div>
                                            {entry.description && (
                                                <p className="text-xs text-muted-foreground">{entry.description}</p>
                                            )}
                                            <div className="text-xs text-muted-foreground pt-1 border-t border-border/30 flex justify-between">
                                                <span>{entry.reference_type ? `${labelize(entry.reference_type)} · ${shortId(entry.reference_id, 10)}` : "—"}</span>
                                                <span>{formatDateTime(entry.created_at)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ─── Refund Ledger ─── */}
            <Card className="glass-card">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <RotateCcw className="h-5 w-5 text-primary" />
                                <CardTitle>Refund Ledger</CardTitle>
                            </div>
                            <CardDescription className="mt-1">Recent refund records linked to corporate outflows.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="w-fit text-xs">
                            {refunds.length} refund{refunds.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {refunds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Ban className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No refunds have been recorded yet.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block overflow-x-auto rounded-lg border border-border/50">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="font-semibold">Order</TableHead>
                                            <TableHead className="font-semibold">Amount</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold">Reason</TableHead>
                                            <TableHead className="text-right font-semibold">Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {refunds.map((refund) => (
                                            <TableRow key={refund.id} className="hover:bg-muted/20">
                                                <TableCell className="font-medium">#{shortId(refund.order_id, 10)}</TableCell>
                                                <TableCell className="font-semibold text-rose-600 dark:text-rose-400">{formatKobo(refund.amount_kobo)}</TableCell>
                                                <TableCell><StatBadge status={refund.status} /></TableCell>
                                                <TableCell className="max-w-[280px] text-sm text-muted-foreground truncate">
                                                    {refund.reason}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                    {formatDateTime(refund.created_at)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile */}
                            <div className="md:hidden space-y-3">
                                {refunds.map((refund) => (
                                    <div key={refund.id} className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">#{shortId(refund.order_id, 10)}</span>
                                            <StatBadge status={refund.status} />
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Amount</span>
                                            <span className="font-semibold text-rose-600 dark:text-rose-400">{formatKobo(refund.amount_kobo)}</span>
                                        </div>
                                        {refund.reason && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">{refund.reason}</p>
                                        )}
                                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                                            {formatDateTime(refund.created_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
