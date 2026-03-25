import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createRefundAction, processRefundAction, reassignOrder, resolveDisputeAction } from "@/actions/platform"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, getOrderStatusClass, getPaymentStatusClass, getSettlementStatusClass, labelize, shortId } from "@/lib/admin-display"
import { formatKobo, koboToNaira } from "@/lib/money"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type OrderRow = {
    id: string
    customer_id: string
    merchant_id: string | null
    assigned_agent_id: string | null
    rider_id: string | null
    status: string
    payment_status: string | null
    total_amount: number
    created_at: string
    payment_ref: string | null
}

type OrderFinancialRow = {
    order_id: string
    merchant_base_total_kobo: number
    agent_fee_total_kobo: number
    app_fee_total_kobo: number
    ops_fee_total_kobo: number
    insurance_total_kobo: number
    vat_total_kobo: number
    grand_total_kobo: number
    delivery_total_kobo: number
    rider_share_kobo: number
    corporate_delivery_share_kobo: number
    settlement_status: string
    settled_at: string | null
}

type ProfileRow = {
    id: string
    full_name: string | null
    phone: string | null
    company_name: string | null
}

type DisputeRow = {
    id: string
    order_id: string
    status: string
    reason: string
    resolution_notes: string | null
    created_at: string
}

type RefundRow = {
    id: string
    order_id: string
    amount_kobo: number
    status: string
    reason: string
    processed_at: string | null
    created_at: string
}

type RoleRow = {
    user_id: string
    role: "agent" | "rider"
}

type OperatorStatusRow = {
    id: string
    status: string | null
}

type AssignmentRow = {
    id: string
    order_id: string
    assignment_role: string
    assignee_id: string | null
    assigned_by: string | null
    method: string | null
    reason: string | null
    is_active: boolean
    accepted_at: string | null
    created_at: string
}

const STATUS_TABS = [
    "awaiting_agent_acceptance",
    "awaiting_merchant_confirmation",
    "processing",
    "ready_for_pickup",
    "out_for_delivery",
    "delivered",
    "completed",
    "disputed",
    "refunded",
] as const

type StatusTab = (typeof STATUS_TABS)[number]

interface PageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function buildOrdersHref(status: StatusTab, query: string) {
    const params = new URLSearchParams({ status })

    if (query) {
        params.set("q", query)
    }

    return `/dashboard/orders?${params.toString()}`
}

function getProfileLabel(profile: ProfileRow | null | undefined, fallback: string | null | undefined) {
    if (profile?.company_name) {
        return profile.company_name
    }

    if (profile?.full_name) {
        return profile.full_name
    }

    return shortId(fallback)
}

function getCorporateRevenueKobo(financial: OrderFinancialRow | undefined) {
    if (!financial) {
        return 0
    }

    return (
        financial.app_fee_total_kobo +
        financial.ops_fee_total_kobo +
        financial.insurance_total_kobo +
        financial.corporate_delivery_share_kobo
    )
}

function matchesSearch(
    order: OrderRow,
    query: string,
    profileMap: Map<string, ProfileRow>,
    financialMap: Map<string, OrderFinancialRow>
) {
    if (!query) {
        return true
    }

    const customer = profileMap.get(order.customer_id)
    const merchant = order.merchant_id ? profileMap.get(order.merchant_id) : null
    const agent = order.assigned_agent_id ? profileMap.get(order.assigned_agent_id) : null
    const rider = order.rider_id ? profileMap.get(order.rider_id) : null
    const financial = financialMap.get(order.id)

    const haystack = [
        order.id,
        order.payment_ref,
        customer?.full_name,
        customer?.phone,
        merchant?.company_name,
        merchant?.full_name,
        agent?.full_name,
        rider?.full_name,
        financial?.settlement_status,
    ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase()

    return haystack.includes(query)
}

export default async function OrdersPage({ searchParams }: PageProps) {
    await requireAdminRouteAccess("orders")
    const params = await searchParams
    const requestedStatus = typeof params.status === "string" ? params.status : "awaiting_agent_acceptance"
    const requestedQuery = typeof params.q === "string" ? params.q.trim().toLowerCase() : ""
    const activeStatus = STATUS_TABS.includes(requestedStatus as StatusTab)
        ? (requestedStatus as StatusTab)
        : "awaiting_agent_acceptance"
    const supabase = await createClient()

    async function reassignOrderForm(formData: FormData) {
        "use server"
        await reassignOrder(formData)
    }

    async function createRefundForm(formData: FormData) {
        "use server"
        await createRefundAction(formData)
    }

    async function processRefundForm(formData: FormData) {
        "use server"
        await processRefundAction(formData)
    }

    async function resolveDisputeForm(formData: FormData) {
        "use server"
        await resolveDisputeAction(formData)
    }

    const [
        statusRowsResult,
        ordersResult,
        disputesResult,
        refundsResult,
        rolesResult,
        agentProfileResult,
        riderProfileResult,
    ] = await Promise.all([
        supabase.from("orders").select("status"),
        supabase
            .from("orders")
            .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, status, payment_status, total_amount, created_at, payment_ref")
            .eq("status", activeStatus)
            .order("created_at", { ascending: false })
            .limit(150),
        supabase
            .from("order_disputes")
            .select("id, order_id, status, reason, resolution_notes, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("refunds")
            .select("id, order_id, amount_kobo, status, reason, processed_at, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["agent", "rider"]),
        supabase.from("agent_profiles").select("id, status"),
        supabase.from("rider_profiles").select("id, status"),
    ])

    const statusRows = (statusRowsResult.data ?? []) as Array<{ status: string }>
    const baseOrders = (ordersResult.data ?? []) as OrderRow[]
    const disputes = (disputesResult.data ?? []) as DisputeRow[]
    const refunds = (refundsResult.data ?? []) as RefundRow[]
    const roleRows = (rolesResult.data ?? []) as RoleRow[]
    const agentProfiles = (agentProfileResult.data ?? []) as OperatorStatusRow[]
    const riderProfiles = (riderProfileResult.data ?? []) as OperatorStatusRow[]

    const statusCounts = STATUS_TABS.reduce<Record<string, number>>((acc, status) => {
        acc[status] = 0
        return acc
    }, {})

    for (const row of statusRows) {
        if (row.status in statusCounts) {
            statusCounts[row.status] += 1
        }
    }

    const orderIds = Array.from(new Set([
        ...baseOrders.map((order) => order.id),
        ...disputes.map((dispute) => dispute.order_id),
        ...refunds.map((refund) => refund.order_id),
    ]))

    const [{ data: financialRowsData }, { data: allOrdersData }, { data: assignmentRowsData }] = await Promise.all([
        orderIds.length > 0
            ? supabase
                .from("order_financials")
                .select("order_id, merchant_base_total_kobo, agent_fee_total_kobo, app_fee_total_kobo, ops_fee_total_kobo, insurance_total_kobo, vat_total_kobo, grand_total_kobo, delivery_total_kobo, rider_share_kobo, corporate_delivery_share_kobo, settlement_status, settled_at")
                .in("order_id", orderIds)
            : Promise.resolve({ data: [] }),
        orderIds.length > 0
            ? supabase
                .from("orders")
                .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, status, payment_status, total_amount, created_at, payment_ref")
                .in("id", orderIds)
            : Promise.resolve({ data: [] }),
        orderIds.length > 0
            ? supabase
                .from("order_assignments")
                .select("id, order_id, assignment_role, assignee_id, assigned_by, method, reason, is_active, accepted_at, created_at")
                .in("order_id", orderIds)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
    ])

    const financialRows = (financialRowsData ?? []) as OrderFinancialRow[]
    const allOrders = (allOrdersData ?? baseOrders) as OrderRow[]
    const assignmentRows = (assignmentRowsData ?? []) as AssignmentRow[]
    const orderMap = new Map(allOrders.map((order) => [order.id, order]))
    const financialMap = new Map(financialRows.map((financial) => [financial.order_id, financial]))

    const profileIds = Array.from(new Set([
        ...allOrders.flatMap((order) => [
            order.customer_id,
            order.merchant_id,
            order.assigned_agent_id,
            order.rider_id,
        ].filter(Boolean) as string[]),
        ...roleRows.map((role) => role.user_id),
        ...assignmentRows.flatMap((assignment) => [
            assignment.assignee_id,
            assignment.assigned_by,
        ].filter(Boolean) as string[]),
    ]))

    const { data: profilesData } = profileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, phone, company_name")
            .in("id", profileIds)
        : { data: [] }

    const profiles = (profilesData ?? []) as ProfileRow[]
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

    const disputesByOrder = new Map<string, DisputeRow[]>()
    for (const dispute of disputes) {
        const current = disputesByOrder.get(dispute.order_id) ?? []
        current.push(dispute)
        disputesByOrder.set(dispute.order_id, current)
    }

    const refundsByOrder = new Map<string, RefundRow[]>()
    for (const refund of refunds) {
        const current = refundsByOrder.get(refund.order_id) ?? []
        current.push(refund)
        refundsByOrder.set(refund.order_id, current)
    }

    const assignmentsByOrder = new Map<string, AssignmentRow[]>()
    for (const assignment of assignmentRows) {
        const current = assignmentsByOrder.get(assignment.order_id) ?? []
        current.push(assignment)
        assignmentsByOrder.set(assignment.order_id, current)
    }

    const approvedAgentIds = new Set(
        agentProfiles.filter((profile) => profile.status === "approved").map((profile) => profile.id)
    )
    const approvedRiderIds = new Set(
        riderProfiles.filter((profile) => profile.status === "approved").map((profile) => profile.id)
    )

    const agentOptions = roleRows
        .filter((role) => role.role === "agent" && approvedAgentIds.has(role.user_id))
        .map((role) => ({
            id: role.user_id,
            label: getProfileLabel(profileMap.get(role.user_id) ?? null, role.user_id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))

    const riderOptions = roleRows
        .filter((role) => role.role === "rider" && approvedRiderIds.has(role.user_id))
        .map((role) => ({
            id: role.user_id,
            label: getProfileLabel(profileMap.get(role.user_id) ?? null, role.user_id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))

    const orders = baseOrders.filter((order) => matchesSearch(order, requestedQuery, profileMap, financialMap))
    const openDisputeCount = disputes.filter((dispute) => dispute.status === "open" || dispute.status === "investigating").length
    const pendingRefundCount = refunds.filter((refund) => refund.status === "pending" || refund.status === "approved").length

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Orders Archive</h1>
                    <p className="text-muted-foreground mt-1 text-base">
                        Manual agent reassignment, rider overrides, dispute handling, and refund controls for the live queue.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="shadow-sm">
                        <Link href="/dashboard/reports">Open company wallet</Link>
                    </Button>
                    <Button asChild className="shadow-sm bg-foreground text-background hover:bg-foreground/90">
                        <Link href="/dashboard/audit-logs">View audit trail</Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6 animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Visible Queue</CardTitle>
                        <CardDescription className="sr-only">{labelize(activeStatus)} orders in the current view.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{orders.length}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Approved Agents</CardTitle>
                        <CardDescription className="sr-only">Operators available for manual reassignment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{agentOptions.length}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Approved Riders</CardTitle>
                        <CardDescription className="sr-only">Riders available for dispatch overrides.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{riderOptions.length}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Disputes</CardTitle>
                        <CardDescription className="sr-only">Orders requiring admin resolution.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{openDisputeCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Refunds</CardTitle>
                        <CardDescription className="sr-only">Corporate outflows waiting to be processed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{pendingRefundCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all md:col-span-2 xl:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Queue Search</CardTitle>
                        <CardDescription className="sr-only">Search by order, payment ref, or assigned actors.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="mb-3 grid gap-2" method="get">
                            <input type="hidden" name="status" value={activeStatus} />
                            <Input
                                name="q"
                                defaultValue={requestedQuery}
                                placeholder="Search IDs, Names..."
                                className="h-8 text-sm bg-muted/30"
                            />
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" className="w-full bg-foreground text-background hover:bg-foreground/90 shadow-sm">
                                    Search
                                </Button>
                                {requestedQuery ? (
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <Link href={buildOrdersHref(activeStatus, "")}>Clear</Link>
                                    </Button>
                                ) : null}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap gap-2 animate-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
                {STATUS_TABS.map((status) => (
                    <Link
                        key={status}
                        href={buildOrdersHref(status, requestedQuery)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                            activeStatus === status
                                ? "border-foreground bg-foreground text-background shadow-xs hover:bg-foreground/90"
                                : "border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        <span>{labelize(status)}</span>
                        <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            activeStatus === status ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                        )}>
                            {statusCounts[status] ?? 0}
                        </span>
                    </Link>
                ))}
            </div>

            <Card className="shadow-sm border-border/60 animate-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both overflow-hidden">
                <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                    <CardTitle className="text-lg">Operational Queue</CardTitle>
                    <CardDescription>
                        Only approved agents and riders are shown in override controls. Every reassignment writes to assignment history and the audit log.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/20">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="py-3 px-4 font-semibold">Order</TableHead>
                                    <TableHead className="px-4 font-semibold">Routing & History</TableHead>
                                    <TableHead className="px-4 font-semibold">Amounts</TableHead>
                                    <TableHead className="px-4 font-semibold">Status</TableHead>
                                    <TableHead className="px-4 font-semibold">Manual Control</TableHead>
                                    <TableHead className="px-4 font-semibold">Refund</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground bg-muted/5">
                                            No orders matched the {labelize(activeStatus)} queue.
                                        </TableCell>
                                    </TableRow>
                                ) : orders.map((order) => {
                                    const customer = profileMap.get(order.customer_id)
                                    const merchant = order.merchant_id ? profileMap.get(order.merchant_id) : null
                                    const agent = order.assigned_agent_id ? profileMap.get(order.assigned_agent_id) : null
                                    const rider = order.rider_id ? profileMap.get(order.rider_id) : null
                                    const financial = financialMap.get(order.id)
                                    const orderDisputes = disputesByOrder.get(order.id) ?? []
                                    const orderRefunds = refundsByOrder.get(order.id) ?? []
                                    const orderAssignments = assignmentsByOrder.get(order.id) ?? []
                                    const defaultRefundKobo = financial?.grand_total_kobo ?? order.total_amount
                                    const isTerminal = ["completed", "cancelled", "refunded"].includes(order.status)
                                    const latestAgentAssignment = orderAssignments.find((assignment) => assignment.assignment_role === "agent")
                                    const latestRiderAssignment = orderAssignments.find((assignment) => assignment.assignment_role === "rider")

                                    return (
                                        <TableRow key={order.id} className="align-top group hover:bg-muted/30 transition-colors">
                                            <TableCell className="min-w-[180px] p-4">
                                                <div className="font-medium">#{shortId(order.id, 10)}</div>
                                                <div className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</div>
                                                {order.payment_ref && (
                                                    <div className="mt-2 text-xs text-muted-foreground">Ref {order.payment_ref}</div>
                                                )}
                                                <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Customer:</span>{" "}
                                                        {getProfileLabel(customer ?? null, order.customer_id)}
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Merchant:</span>{" "}
                                                        {getProfileLabel(merchant ?? null, order.merchant_id)}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[320px]">
                                                <div className="space-y-3">
                                                    <div className="rounded-lg border p-3 text-sm">
                                                        <div className="font-medium">Current routing</div>
                                                        <div className="mt-2 space-y-1 text-muted-foreground">
                                                            <div>
                                                                Agent: <span className="text-foreground">{getProfileLabel(agent ?? null, order.assigned_agent_id)}</span>
                                                            </div>
                                                            <div>
                                                                Rider: <span className="text-foreground">{getProfileLabel(rider ?? null, order.rider_id)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {latestAgentAssignment ? (
                                                                <Badge variant="outline">
                                                                    Agent {labelize(latestAgentAssignment.method ?? "auto")}
                                                                </Badge>
                                                            ) : null}
                                                            {latestRiderAssignment ? (
                                                                <Badge variant="outline">
                                                                    Rider {labelize(latestRiderAssignment.method ?? "claim")}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                            Assignment history
                                                        </div>
                                                        {orderAssignments.length === 0 ? (
                                                            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                                                No assignment records yet.
                                                            </div>
                                                        ) : (
                                                            orderAssignments.slice(0, 3).map((assignment) => {
                                                                const assignee = assignment.assignee_id ? profileMap.get(assignment.assignee_id) : null
                                                                const assigner = assignment.assigned_by ? profileMap.get(assignment.assigned_by) : null

                                                                return (
                                                                    <div key={assignment.id} className="rounded-lg border p-3 text-sm">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <Badge variant="outline">{labelize(assignment.assignment_role)}</Badge>
                                                                            <Badge variant="outline">{labelize(assignment.method ?? "auto")}</Badge>
                                                                            {assignment.is_active ? (
                                                                                <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="mt-2 text-muted-foreground">
                                                                            {getProfileLabel(assignee ?? null, assignment.assignee_id)}
                                                                            {assigner ? ` • by ${getProfileLabel(assigner, assignment.assigned_by)}` : ""}
                                                                        </div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                                            {formatDateTime(assignment.created_at)}
                                                                            {assignment.accepted_at ? ` • accepted ${formatDateTime(assignment.accepted_at)}` : ""}
                                                                        </div>
                                                                        {assignment.reason ? (
                                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                                {assignment.reason}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[220px]">
                                                <div className="space-y-1 text-sm">
                                                    <div className="font-medium">{formatKobo(financial?.grand_total_kobo ?? order.total_amount)}</div>
                                                    <div className="text-muted-foreground">Merchant {formatKobo(financial?.merchant_base_total_kobo ?? 0)}</div>
                                                    <div className="text-muted-foreground">Agent {formatKobo(financial?.agent_fee_total_kobo ?? 0)}</div>
                                                    <div className="text-muted-foreground">Rider {formatKobo(financial?.rider_share_kobo ?? 0)}</div>
                                                    <div className="text-muted-foreground">Company revenue {formatKobo(getCorporateRevenueKobo(financial))}</div>
                                                    <div className="text-muted-foreground">VAT {formatKobo(financial?.vat_total_kobo ?? 0)}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[180px]">
                                                <div className="flex flex-col gap-2">
                                                    <Badge variant="outline" className={cn("w-fit", getOrderStatusClass(order.status))}>
                                                        {labelize(order.status)}
                                                    </Badge>
                                                    <Badge variant="outline" className={cn("w-fit", getPaymentStatusClass(order.payment_status))}>
                                                        {labelize(order.payment_status)}
                                                    </Badge>
                                                    <Badge variant="outline" className={cn("w-fit", getSettlementStatusClass(financial?.settlement_status))}>
                                                        {labelize(financial?.settlement_status ?? "legacy")}
                                                    </Badge>
                                                    {financial?.settled_at && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Settled {formatDateTime(financial.settled_at)}
                                                        </div>
                                                    )}
                                                    {orderDisputes.length > 0 && (
                                                        <Badge variant="destructive" className="w-fit">
                                                            {orderDisputes.length} dispute
                                                        </Badge>
                                                    )}
                                                    {orderRefunds.length > 0 && (
                                                        <Badge variant="secondary" className="w-fit">
                                                            {labelize(orderRefunds[0].status)} refund
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[340px] p-4">
                                                {isTerminal ? (
                                                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-xs font-medium text-muted-foreground text-center">
                                                        Overrides are disabled for terminal orders.
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3">
                                                        <form action={reassignOrderForm} className="grid gap-2.5 rounded-lg border border-border/60 bg-card p-3 shadow-xs">
                                                            <input type="hidden" name="order_id" value={order.id} />
                                                            <input type="hidden" name="assignment_role" value="agent" />
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                                    Agent override
                                                                </div>
                                                                {latestAgentAssignment?.accepted_at ? (
                                                                    <Badge variant="outline">Accepted</Badge>
                                                                ) : (
                                                                    <Badge variant="outline">Pending</Badge>
                                                                )}
                                                            </div>
                                                            <select name="new_assignee_id" defaultValue={order.assigned_agent_id ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring">
                                                                <option value="">Select approved agent</option>
                                                                {agentOptions.map((option) => (
                                                                    <option key={option.id} value={option.id}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <Input name="reason" defaultValue="Admin agent override" required className="h-8 text-xs" />
                                                            <Button type="submit" variant="outline" size="sm" disabled={agentOptions.length === 0} className="w-full text-foreground hover:bg-muted/50 hover:text-foreground">
                                                                Reassign Agent
                                                            </Button>
                                                        </form>

                                                        <form action={reassignOrderForm} className="grid gap-2.5 rounded-lg border border-border/60 bg-card p-3 shadow-xs">
                                                            <input type="hidden" name="order_id" value={order.id} />
                                                            <input type="hidden" name="assignment_role" value="rider" />
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                                    Rider override
                                                                </div>
                                                                {latestRiderAssignment ? (
                                                                    <Badge variant="outline">{labelize(latestRiderAssignment.method ?? "claim")}</Badge>
                                                                ) : (
                                                                    <Badge variant="outline">Unassigned</Badge>
                                                                )}
                                                            </div>
                                                            <select name="new_assignee_id" defaultValue={order.rider_id ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring">
                                                                <option value="">Select approved rider</option>
                                                                {riderOptions.map((option) => (
                                                                    <option key={option.id} value={option.id}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <Input name="reason" defaultValue="Admin rider override" required className="h-8 text-xs" />
                                                            <Button type="submit" variant="outline" size="sm" disabled={riderOptions.length === 0} className="w-full text-foreground hover:bg-muted/50 hover:text-foreground">
                                                                Reassign Rider
                                                            </Button>
                                                        </form>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="min-w-[240px] p-4">
                                                {orderRefunds.length > 0 ? (
                                                    <div className="grid gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-xs">
                                                        <div className="text-sm font-medium">{formatKobo(orderRefunds[0].amount_kobo)}</div>
                                                        <div className="text-xs text-muted-foreground">{orderRefunds[0].reason}</div>
                                                        <Badge variant="outline">{labelize(orderRefunds[0].status)}</Badge>
                                                        {orderRefunds[0].status !== "processed" && (
                                                            <form action={processRefundForm}>
                                                                <input type="hidden" name="refund_id" value={orderRefunds[0].id} />
                                                                <Button type="submit" size="sm" className="w-full bg-foreground text-background hover:bg-foreground/90 mt-1">
                                                                    Process Refund
                                                                </Button>
                                                            </form>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <form action={createRefundForm} className="grid gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-xs">
                                                        <input type="hidden" name="order_id" value={order.id} />
                                                        <div className="text-xs font-medium text-muted-foreground">Create Refund</div>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            name="amount_naira"
                                                            defaultValue={koboToNaira(defaultRefundKobo)}
                                                            required
                                                        />
                                                        <Input name="reason" defaultValue="Admin approved refund" required className="h-8 text-xs" />
                                                        <Button type="submit" variant="outline" size="sm" className="w-full hover:bg-secondary transition-colors mt-1">
                                                            Create Refund
                                                        </Button>
                                                    </form>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2 animate-in slide-in-from-bottom-10 duration-700 delay-700 fill-mode-both">
                <Card className="shadow-sm border-border/60">
                    <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                        <CardTitle className="text-lg">Open Disputes</CardTitle>
                        <CardDescription>Resolve disputes before payout-side financial actions continue.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        {disputes.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm font-medium text-muted-foreground">
                                No disputes have been raised.
                            </div>
                        ) : disputes.map((dispute) => {
                            const disputeOrder = orderMap.get(dispute.order_id)

                            return (
                                <div key={dispute.id} className="grid gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-xs">
                                    <div className="border-b border-border/40 pb-3">
                                        <div className="font-semibold">Order #{shortId(dispute.order_id, 10)}</div>
                                        <div className="text-sm text-muted-foreground mt-1">{dispute.reason}</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Badge variant="outline">{labelize(dispute.status)}</Badge>
                                            {disputeOrder && (
                                                <Badge variant="outline" className={cn(getOrderStatusClass(disputeOrder.status))}>
                                                    {labelize(disputeOrder.status)}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {dispute.status === "open" || dispute.status === "investigating" ? (
                                        <form action={resolveDisputeForm} className="grid gap-3 mt-1">
                                            <input type="hidden" name="dispute_id" value={dispute.id} />
                                            <select name="status" defaultValue="resolved" className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring">
                                                <option value="resolved">Resolved</option>
                                                <option value="rejected">Rejected</option>
                                                <option value="refunded">Refunded</option>
                                            </select>
                                            <Input name="resolution_notes" defaultValue="Admin resolution recorded" required className="text-sm" />
                                            <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto">
                                                Resolve Dispute
                                            </Button>
                                        </form>
                                    ) : (
                                        <div className="text-sm text-muted-foreground mt-1 bg-muted/30 p-3 rounded-md border border-border/40">
                                            <span className="font-medium block mb-1">Resolution</span>
                                            {dispute.resolution_notes || "Resolution has already been recorded."}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/60">
                    <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                        <CardTitle className="text-lg">Recent Refunds</CardTitle>
                        <CardDescription>Corporate-wallet refunds are traceable and processed separately from merchant settlements.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        {refunds.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm font-medium text-muted-foreground">
                                No refund requests yet.
                            </div>
                        ) : refunds.map((refund) => (
                            <div key={refund.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-xs">
                                <div>
                                    <div className="font-semibold">Order #{shortId(refund.order_id, 10)}</div>
                                    <div className="text-sm text-muted-foreground mt-1">{refund.reason}</div>
                                    <div className="mt-2 text-sm font-medium">{formatKobo(refund.amount_kobo)}</div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant="outline">{labelize(refund.status)}</Badge>
                                    <div className="text-xs text-muted-foreground">{formatDateTime(refund.processed_at ?? refund.created_at)}</div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
