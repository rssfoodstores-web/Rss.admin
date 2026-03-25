import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, getOrderStatusClass, getSettlementStatusClass, labelize, shortId } from "@/lib/admin-display"
import { formatKobo } from "@/lib/money"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PackageOpen, Clock, Truck, AlertCircle, Wallet, ChevronRight, Activity, CircleDollarSign, ShieldAlert } from "lucide-react"
type OrderStatusRow = {
    status: string
}

type DisputeRow = {
    id: string
    status: string
}

type CorporateWalletRow = {
    available_balance_kobo: number
    locked_balance_kobo: number
}

type RecentOrderRow = {
    id: string
    status: string
    total_amount: number
    created_at: string
    payment_ref: string | null
}

type RecentFinancialRow = {
    order_id: string
    app_fee_total_kobo: number
    ops_fee_total_kobo: number
    insurance_total_kobo: number
    corporate_delivery_share_kobo: number
    vat_total_kobo: number
    settlement_status: string
    settled_at: string | null
    created_at: string
}

function getCorporateRevenueKobo(financial: RecentFinancialRow) {
    return (
        financial.app_fee_total_kobo +
        financial.ops_fee_total_kobo +
        financial.insurance_total_kobo +
        financial.corporate_delivery_share_kobo
    )
}

export default async function DashboardPage() {
    await requireAdminRouteAccess("dashboard", { redirectToFirstAccessible: true })
    const supabase = await createClient()

    const [
        orderStatusResult,
        disputeResult,
        walletResult,
        recentOrdersResult,
        recentFinancialsResult,
    ] = await Promise.all([
        supabase.from("orders").select("status"),
        supabase
            .from("order_disputes")
            .select("id, status")
            .in("status", ["open", "investigating"]),
        supabase
            .from("corporate_wallets")
            .select("available_balance_kobo, locked_balance_kobo")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("orders")
            .select("id, status, total_amount, created_at, payment_ref")
            .order("created_at", { ascending: false })
            .limit(6),
        supabase
            .from("order_financials")
            .select("order_id, app_fee_total_kobo, ops_fee_total_kobo, insurance_total_kobo, corporate_delivery_share_kobo, vat_total_kobo, settlement_status, settled_at, created_at")
            .order("created_at", { ascending: false })
            .limit(6),
    ])

    const orderStatusRows = (orderStatusResult.data ?? []) as OrderStatusRow[]
    const openDisputes = (disputeResult.data ?? []) as DisputeRow[]
    const wallet = (walletResult.data ?? null) as CorporateWalletRow | null
    const recentOrders = (recentOrdersResult.data ?? []) as RecentOrderRow[]
    const recentFinancials = (recentFinancialsResult.data ?? []) as RecentFinancialRow[]

    const activeOrderStatuses = new Set([
        "awaiting_agent_acceptance",
        "awaiting_merchant_confirmation",
        "processing",
        "ready_for_pickup",
        "out_for_delivery",
        "delivered",
    ])

    const activeOrdersCount = orderStatusRows.filter((row) => activeOrderStatuses.has(row.status)).length
    const awaitingAgentCount = orderStatusRows.filter((row) => row.status === "awaiting_agent_acceptance").length
    const dispatchLiveCount = orderStatusRows.filter((row) => ["ready_for_pickup", "out_for_delivery"].includes(row.status)).length
    const settledRevenueKobo = recentFinancials
        .filter((financial) => financial.settlement_status === "completed")
        .reduce((sum, financial) => sum + getCorporateRevenueKobo(financial), 0)

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">Admin Overview</h1>
                    <p className="text-muted-foreground mt-1 text-base">
                        Live operations, company wallet visibility, and the fastest paths into order control.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline" className="shadow-sm">
                        <Link href="/dashboard/orders">Open orders</Link>
                    </Button>
                    <Button asChild className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20 transition-all">
                        <Link href="/dashboard/reports">Open finance</Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="relative overflow-hidden group hover:border-orange-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Orders</CardTitle>
                            <CardDescription className="sr-only">Orders moving through workflow</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{activeOrdersCount}</div>
                        </div>
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                    </CardHeader>
                </Card>

                <Card className="relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Agent</CardTitle>
                            <CardDescription className="sr-only">Orders waiting for agent</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{awaitingAgentCount}</div>
                        </div>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                </Card>

                <Card className="relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatch Live</CardTitle>
                            <CardDescription className="sr-only">Orders in delivery motion</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{dispatchLiveCount}</div>
                        </div>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardHeader>
                </Card>

                <Card className="relative overflow-hidden group hover:border-red-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Open Disputes</CardTitle>
                            <CardDescription className="sr-only">Active exceptions</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{openDisputes.length}</div>
                        </div>
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                    </CardHeader>
                </Card>

                <Card className="relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-col items-start justify-between h-full space-y-2">
                        <div className="flex w-full justify-between items-start">
                             <div className="space-y-1">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Company Wallet</CardTitle>
                            </div>
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                        <div className="pt-2">
                            <div className="text-2xl font-bold tracking-tight">{formatKobo(wallet?.available_balance_kobo ?? 0)}</div>
                            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
                                VAT reserve: {formatKobo(wallet?.locked_balance_kobo ?? 0)}
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <PackageOpen className="h-5 w-5 text-orange-500" />
                            Immediate Actions
                        </CardTitle>
                        <CardDescription>Shift-critical tasks requiring attention.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-border/50 p-5 hover:shadow-md hover:border-orange-500/30 transition-all bg-card flex flex-col justify-between group">
                            <div>
                                <div className="text-sm font-semibold flex items-center justify-between">
                                    Manual assignment control
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                    Reassign agents or riders, inspect assignment history, and process exceptions.
                                </p>
                            </div>
                            <Button asChild variant="ghost" className="mt-6 w-max -ml-3 group-hover:text-orange-600 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/50 transition-colors">
                                <Link href="/dashboard/orders" className="flex items-center">
                                    Open queue
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                        
                        <div className="rounded-xl border border-border/50 p-5 hover:shadow-md hover:border-orange-500/30 transition-all bg-card flex flex-col justify-between group">
                            <div>
                                <div className="text-sm font-semibold flex items-center justify-between">
                                    Company wallet
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                    Review wallet balances, per-order revenue, VAT liabilities, and refund outflows.
                                </p>
                            </div>
                            <Button asChild variant="ghost" className="mt-6 w-max -ml-3 group-hover:text-orange-600 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/50 transition-colors">
                                <Link href="/dashboard/reports" className="flex items-center">
                                    Finance view
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>

                        <div className="rounded-xl border border-border/50 p-5 bg-gradient-to-br from-emerald-50/30 to-transparent dark:from-emerald-950/20">
                            <div className="text-sm font-semibold flex items-center gap-2">
                                <CircleDollarSign className="h-4 w-4 text-emerald-500" />
                                Recent settled revenue
                            </div>
                            <p className="mt-4 text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                                {formatKobo(settledRevenueKobo)}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground font-medium">
                                Latest completed settlement entries
                            </p>
                        </div>

                        <div className="rounded-xl border border-border/50 p-5 bg-gradient-to-br from-red-50/30 to-transparent dark:from-red-950/20">
                            <div className="text-sm font-semibold flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                Exception pressure
                            </div>
                            <p className="mt-4 text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400">
                                {openDisputes.length}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground font-medium">
                                Open disputes pending review
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-4">
                        <CardTitle>Recent Settlements</CardTitle>
                        <CardDescription>Latest finance movements from completed orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentFinancials.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center flex flex-col items-center justify-center">
                                    <CircleDollarSign className="h-8 w-8 text-muted-foreground/40 mb-3" />
                                    <span className="text-sm font-medium text-muted-foreground">No settlement activity recorded yet.</span>
                                </div>
                            ) : (
                                recentFinancials.map((financial) => (
                                    <div key={financial.order_id} className="group relative rounded-xl border border-border/50 p-4 hover:border-border transition-colors hover:shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-sm">Order #{shortId(financial.order_id, 10)}</div>
                                                <div className="text-xs text-muted-foreground font-medium">
                                                    {formatDateTime(financial.settled_at ?? financial.created_at)}
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className={cn(getSettlementStatusClass(financial.settlement_status), "shadow-sm")}>
                                                {labelize(financial.settlement_status)}
                                            </Badge>
                                        </div>
                                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground bg-muted/30 p-2 rounded-lg">
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                                <span className="truncate">Rev: <span className="text-foreground">{formatKobo(getCorporateRevenueKobo(financial))}</span></span>
                                            </span>
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                                                <span className="truncate">VAT: <span className="text-foreground">{formatKobo(financial.vat_total_kobo)}</span></span>
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
                <Card className="shadow-sm border-border/60">
                    <CardHeader>
                        <CardTitle>Latest Orders</CardTitle>
                        <CardDescription>Newest orders entering the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="-mx-6 border-y sm:mx-0 sm:border sm:rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[140px] px-4 py-3 font-semibold">Order</TableHead>
                                            <TableHead className="px-4 font-semibold">Amount</TableHead>
                                            <TableHead className="px-4 font-semibold">Status</TableHead>
                                            <TableHead className="text-right px-4 font-semibold">Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <PackageOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                                        <span className="text-sm font-medium">No recent orders found.</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            recentOrders.map((order) => (
                                                <TableRow key={order.id} className="group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="px-4 py-3">
                                                        <div className="font-semibold text-sm text-foreground">#{shortId(order.id, 10)}</div>
                                                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]" title={order.payment_ref ?? "No ref"}>{order.payment_ref ?? "No ref"}</div>
                                                    </TableCell>
                                                    <TableCell className="px-4 font-medium">{formatKobo(order.total_amount)}</TableCell>
                                                    <TableCell className="px-4">
                                                        <Badge variant="secondary" className={cn(getOrderStatusClass(order.status), "shadow-sm")}>
                                                            {labelize(order.status)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                        {formatDateTime(order.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/60">
                    <CardHeader>
                        <CardTitle>Quick Links</CardTitle>
                        <CardDescription>Shortcuts to your most used admin areas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <Link href="/dashboard/orders" className="group rounded-xl border border-border/60 p-5 transition-all hover:border-orange-400 hover:shadow-md hover:shadow-orange-500/10 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 active:scale-[0.98] duration-200">
                                <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                    <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                        <PackageOpen className="h-4 w-4" />
                                    </div>
                                    Order Control
                                </div>
                                <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                    Reassign agents, override riders, resolve disputes, and process refunds.
                                </div>
                            </Link>
                            
                            <Link href="/dashboard/reports" className="group rounded-xl border border-border/60 p-5 transition-all hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 active:scale-[0.98] duration-200">
                                <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                        <Wallet className="h-4 w-4" />
                                    </div>
                                    Finance
                                </div>
                                <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                    Company wallet balances, per-order revenue, VAT, and refund reporting.
                                </div>
                            </Link>
                            
                            <Link href="/dashboard/approvals" className="group rounded-xl border border-border/60 p-5 transition-all hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 active:scale-[0.98] duration-200 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                                <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                        <ShieldAlert className="h-4 w-4" />
                                    </div>
                                    System Approvals
                                </div>
                                <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                    Review role applications, product submissions, and pending operational setup items across the platform.
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
