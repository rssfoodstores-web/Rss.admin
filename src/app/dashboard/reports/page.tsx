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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Company Wallet & Finance</h1>
                <p className="text-muted-foreground">
                    Company wallet visibility, per-order revenue, VAT tracking, refunds, and exportable reporting.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Corporate Balance</CardTitle>
                        <CardDescription>Available RSS corporate wallet balance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(wallet?.available_balance_kobo ?? 0)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Locked Balance</CardTitle>
                        <CardDescription>Reserved corporate funds.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(wallet?.locked_balance_kobo ?? 0)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Company Revenue</CardTitle>
                        <CardDescription>Realized company revenue from settled orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(corporateRevenueKobo)}</div>
                        <div className="mt-2 text-sm text-muted-foreground">Unsettled pipeline {formatKobo(unsettledRevenueKobo)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>VAT Logged</CardTitle>
                        <CardDescription>VAT liabilities in the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(vatTotalKobo)}</div>
                        <div className="mt-2 text-sm text-muted-foreground">Taxable base {formatKobo(taxableBaseKobo)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Merchant Payouts</CardTitle>
                        <CardDescription>Total settled merchant base payouts.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(merchantPayoutKobo)}</div>
                        <div className="mt-2 text-sm text-muted-foreground">Agent {formatKobo(agentPayoutKobo)} • Rider {formatKobo(riderPayoutKobo)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Refunded Outflow</CardTitle>
                        <CardDescription>Processed refund amount.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatKobo(refundedKobo)}</div>
                        <div className="mt-2 text-sm text-muted-foreground">Ledger inflow {formatKobo(creditedLedgerKobo)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Settled Orders</CardTitle>
                        <CardDescription>Orders that reached completed settlement.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{settledFinancialRows.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Corporate Wallet</CardTitle>
                        <CardDescription>
                            Primary wallet `{wallet?.wallet_key ?? "rss_primary"}` updated {formatDateTime(wallet?.updated_at ?? null)}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border p-4">
                            <div className="text-sm text-muted-foreground">Wallet Health</div>
                            <div className="mt-2 font-medium">
                                Available {formatKobo(wallet?.available_balance_kobo ?? 0)}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Reserved VAT {formatKobo(wallet?.locked_balance_kobo ?? 0)}
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <div className="text-sm text-muted-foreground">Ledger Categories</div>
                            <div className="mt-2 space-y-1 text-sm">
                                {Object.entries(ledgerCategoryTotals).length === 0 ? (
                                    <div className="text-muted-foreground">No ledger entries in this range.</div>
                                ) : (
                                    Object.entries(ledgerCategoryTotals).map(([category, amount]) => (
                                        <div key={category} className="flex items-center justify-between gap-3">
                                            <span>{labelize(category)}</span>
                                            <span className="font-medium">{formatKobo(amount)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <div className="text-sm text-muted-foreground">Delivery Split</div>
                            <div className="mt-2 font-medium">
                                Rider {formatPercentFromBps(Number(deliverySettings.rider_share_bps ?? 8000))} • Corporate {formatPercentFromBps(Number(deliverySettings.corporate_delivery_share_bps ?? 2000))}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Base Fare {formatKobo(Number(deliverySettings.base_fare_kobo ?? 0))} • Distance {formatKobo(Number(deliverySettings.distance_rate_kobo_per_km ?? 0))}/km
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <div className="text-sm text-muted-foreground">Platform Fees</div>
                            <div className="mt-2 font-medium">
                                Agent {formatPercentFromBps(Number(platformSettings.agent_fee_bps ?? 200))} • App {formatPercentFromBps(Number(platformSettings.app_fee_bps ?? 1000))}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Ops {formatPercentFromBps(Number(platformSettings.ops_fee_bps ?? 200))} • VAT {formatPercentFromBps(Number(platformSettings.vat_bps ?? 750))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>VAT Export</CardTitle>
                        <CardDescription>Filter tax liabilities and export as CSV.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <form className="grid gap-3 md:grid-cols-2" method="get">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">From</label>
                                <Input type="date" name="from" defaultValue={from} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">To</label>
                                <Input type="date" name="to" defaultValue={to} />
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" variant="outline">Apply Filter</Button>
                                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                                    <Link href={csvHref}>Export CSV</Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Per-Order Revenue Breakdown</CardTitle>
                    <CardDescription>
                        Company revenue per order is calculated as app fee + ops fee + insurance + corporate delivery share.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Merchant</TableHead>
                                    <TableHead>Gross</TableHead>
                                    <TableHead>Company Revenue</TableHead>
                                    <TableHead>VAT</TableHead>
                                    <TableHead>Payouts</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Settled</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {financialRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No order financials match the current filter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    financialRows.map((financial) => {
                                        const order = orderMap.get(financial.order_id)
                                        const merchant = order?.merchant_id ? profileMap.get(order.merchant_id) : null

                                        return (
                                            <TableRow key={financial.order_id}>
                                                <TableCell>
                                                    <div className="font-medium">#{shortId(financial.order_id, 10)}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {order?.payment_ref ?? "No ref"}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {merchant?.company_name ?? merchant?.full_name ?? "Unknown merchant"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {labelize(order?.status ?? "unknown")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatKobo(financial.grand_total_kobo)}</TableCell>
                                                <TableCell>{formatKobo(getCorporateRevenueKobo(financial))}</TableCell>
                                                <TableCell>{formatKobo(financial.vat_total_kobo)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    Merchant {formatKobo(financial.merchant_base_total_kobo)}
                                                    <br />
                                                    Agent {formatKobo(financial.agent_fee_total_kobo)} • Rider {formatKobo(financial.rider_share_kobo)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{labelize(financial.settlement_status)}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                    {formatDateTime(financial.settled_at ?? financial.created_at)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>VAT Liabilities</CardTitle>
                        <CardDescription>One row per completed order settlement.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order</TableHead>
                                        <TableHead>Tax Base</TableHead>
                                        <TableHead>VAT</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taxRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                No VAT liabilities match the current filter.
                                            </TableCell>
                                        </TableRow>
                                    ) : taxRows.map((tax) => (
                                        <TableRow key={tax.id}>
                                            <TableCell>#{shortId(tax.order_id, 10)}</TableCell>
                                            <TableCell>{formatKobo(tax.taxable_base_kobo)}</TableCell>
                                            <TableCell>{formatKobo(tax.vat_amount_kobo)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{labelize(tax.status)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatDateTime(tax.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Corporate Ledger</CardTitle>
                        <CardDescription>Append-only corporate ledger entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ledgerEntries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                No corporate ledger entries have been recorded yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : ledgerEntries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>
                                                <div className="font-medium">{labelize(entry.category)}</div>
                                                <div className="text-sm text-muted-foreground">{entry.description || "No description"}</div>
                                            </TableCell>
                                            <TableCell>{formatKobo(entry.amount_kobo)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {entry.reference_type ? `${labelize(entry.reference_type)} • ${shortId(entry.reference_id, 10)}` : "N/A"}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatDateTime(entry.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Refund Ledger</CardTitle>
                    <CardDescription>Recent refund records linked to corporate outflows.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {refunds.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No refunds have been recorded yet.
                                        </TableCell>
                                    </TableRow>
                                ) : refunds.map((refund) => (
                                    <TableRow key={refund.id}>
                                        <TableCell>#{shortId(refund.order_id, 10)}</TableCell>
                                        <TableCell>{formatKobo(refund.amount_kobo)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{labelize(refund.status)}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[320px] text-sm text-muted-foreground">
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
                </CardContent>
            </Card>
        </div>
    )
}
