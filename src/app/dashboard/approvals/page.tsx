import { createClient } from "@/lib/supabase/server"
import { approveAgent, approveMerchant, approveRider, rejectAgent, rejectMerchant, rejectRider } from "@/actions/approvals"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, formatPercentFromBps, labelize } from "@/lib/admin-display"
import { formatKobo, koboToNaira } from "@/lib/money"
import { PricingApprovalControls } from "@/components/dashboard/approvals/PricingApprovalControls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tags, Store, Bike, Users, ShieldAlert, CheckCircle2, XCircle } from "lucide-react"

type ProductRow = {
    id: string
    name: string
    category: string | null
    stock_level: number | null
    merchant_id: string
    status: string
    created_at: string
    price: number | null
    submitted_for_review_at: string | null
}

type PriceInputRow = {
    product_id: string
    source: "merchant" | "agent" | "admin"
    amount_kobo: number
    created_at: string
}

type SnapshotRow = {
    product_id: string
    approved_price_kobo: number
    agent_fee_bps: number
    app_fee_bps: number
    ops_fee_bps: number
    insurance_kobo: number
    vat_bps: number
    approved_at: string
}

type ProfileRow = {
    id: string
    full_name: string | null
    company_name: string | null
    phone: string | null
}

type RiderRow = {
    id: string
    status: string | null
    created_at: string
}

type MerchantRow = {
    id: string
    store_name: string
    business_address: string | null
    status: string | null
    created_at: string
}

type AgentRow = {
    id: string
    status: string | null
    created_at: string
    bank_details: Record<string, string> | null
    id_card_url: string | null
}

function getLatestInputs(inputs: PriceInputRow[], productId: string) {
    return {
        merchant: inputs.find((input) => input.product_id === productId && input.source === "merchant") ?? null,
        agent: inputs.find((input) => input.product_id === productId && input.source === "agent") ?? null,
        admin: inputs.find((input) => input.product_id === productId && input.source === "admin") ?? null,
    }
}

export default async function ApprovalsPage() {
    await requireAdminRouteAccess("approvals")
    const supabase = await createClient()

    async function approveMerchantForm(formData: FormData) {
        "use server"
        await approveMerchant(String(formData.get("merchant_id") ?? ""))
    }

    async function rejectMerchantForm(formData: FormData) {
        "use server"
        await rejectMerchant(String(formData.get("merchant_id") ?? ""))
    }

    async function approveRiderForm(formData: FormData) {
        "use server"
        await approveRider(String(formData.get("rider_id") ?? ""))
    }

    async function rejectRiderForm(formData: FormData) {
        "use server"
        await rejectRider(String(formData.get("rider_id") ?? ""))
    }

    async function approveAgentForm(formData: FormData) {
        "use server"
        await approveAgent(String(formData.get("agent_id") ?? ""))
    }

    async function rejectAgentForm(formData: FormData) {
        "use server"
        await rejectAgent(String(formData.get("agent_id") ?? ""))
    }

    const [productsResult, ridersResult, merchantsResult, agentsResult, platformResult] = await Promise.all([
        supabase
            .from("products")
            .select("id, name, category, stock_level, merchant_id, status, created_at, price, submitted_for_review_at")
            .eq("status", "pending")
            .order("submitted_for_review_at", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false }),
        supabase
            .from("rider_profiles")
            .select("id, status, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        supabase
            .from("merchants")
            .select("id, store_name, business_address, status, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        supabase
            .from("agent_profiles")
            .select("id, status, created_at, bank_details, id_card_url")
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", "platform_financial_settings")
            .single(),
    ])

    const products = (productsResult.data ?? []) as ProductRow[]
    const riders = (ridersResult.data ?? []) as RiderRow[]
    const merchants = (merchantsResult.data ?? []) as MerchantRow[]
    const agents = (agentsResult.data ?? []) as AgentRow[]
    const platformSettings = (platformResult.data?.value ?? {}) as Record<string, number>

    const productIds = products.map((product) => product.id)
    const profileIds = Array.from(new Set([
        ...products.map((product) => product.merchant_id),
        ...riders.map((rider) => rider.id),
        ...merchants.map((merchant) => merchant.id),
        ...agents.map((agent) => agent.id),
    ]))

    const [{ data: priceInputsData }, { data: snapshotsData }, { data: profilesData }] = await Promise.all([
        productIds.length > 0
            ? supabase
                .from("product_price_inputs")
                .select("product_id, source, amount_kobo, created_at")
                .in("product_id", productIds)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        productIds.length > 0
            ? supabase
                .from("product_pricing_snapshots")
                .select("product_id, approved_price_kobo, agent_fee_bps, app_fee_bps, ops_fee_bps, insurance_kobo, vat_bps, approved_at")
                .in("product_id", productIds)
                .eq("is_active", true)
                .order("approved_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        profileIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .in("id", profileIds)
            : Promise.resolve({ data: [] }),
    ])

    const priceInputs = (priceInputsData ?? []) as PriceInputRow[]
    const snapshots = (snapshotsData ?? []) as SnapshotRow[]
    const profiles = (profilesData ?? []) as ProfileRow[]

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
    const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.product_id, snapshot]))

    const agentFeeBps = Number(platformSettings.agent_fee_bps ?? 200)
    const appFeeBps = Number(platformSettings.app_fee_bps ?? 1000)
    const opsFeeBps = Number(platformSettings.ops_fee_bps ?? 200)
    const vatBps = Number(platformSettings.vat_bps ?? 750)
    const insuranceDefaultKobo = Number(platformSettings.insurance_default_kobo ?? 0)

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700 pb-8">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">Pricing And Approvals</h1>
                <p className="text-muted-foreground mt-1 text-base">
                    Approve final customer pricing, clear merchant onboarding, and manage rider and agent verification.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="relative overflow-hidden group hover:border-orange-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Pricing Queue</CardTitle>
                            <CardDescription className="sr-only">Products waiting for pricing.</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{products.length}</div>
                        </div>
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <Tags className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                    </CardHeader>
                </Card>
                <Card className="relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Merchant Approvals</CardTitle>
                            <CardDescription className="sr-only">Merchants awaiting activation.</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{merchants.length}</div>
                        </div>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                </Card>
                <Card className="relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Rider Approvals</CardTitle>
                            <CardDescription className="sr-only">Riders waiting for review.</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{riders.length}</div>
                        </div>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <Bike className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardHeader>
                </Card>
                <Card className="relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Agent Approvals</CardTitle>
                            <CardDescription className="sr-only">Agents waiting for review.</CardDescription>
                            <div className="text-3xl font-bold tracking-tight">{agents.length}</div>
                        </div>
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <Card className="shadow-sm border-border/60 animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <Tags className="h-5 w-5 text-orange-500" />
                        Pricing Approval Workspace
                    </CardTitle>
                    <CardDescription>
                        Merchant and agent inputs are internal references. Customer price becomes live only after final admin approval.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
                        <Badge variant="secondary" className="bg-background shadow-sm">Agent Fee {formatPercentFromBps(agentFeeBps)}</Badge>
                        <Badge variant="secondary" className="bg-background shadow-sm">App Fee {formatPercentFromBps(appFeeBps)}</Badge>
                        <Badge variant="secondary" className="bg-background shadow-sm">Ops Fee {formatPercentFromBps(opsFeeBps)}</Badge>
                        <Badge variant="secondary" className="bg-background shadow-sm">VAT {formatPercentFromBps(vatBps)}</Badge>
                        <Badge variant="secondary" className="bg-background shadow-sm">Insurance Default {formatKobo(insuranceDefaultKobo)}</Badge>
                    </div>
                    <div className="-mx-6 border-y sm:mx-0 sm:border sm:rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[280px] px-4 py-3 font-semibold">Product</TableHead>
                                        <TableHead className="px-4 font-semibold">Merchant Input</TableHead>
                                        <TableHead className="px-4 font-semibold">Agent Input</TableHead>
                                        <TableHead className="px-4 font-semibold">Current Approved</TableHead>
                                        <TableHead className="min-w-[320px] px-4 font-semibold">Approval</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-40 text-center">
                                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                    <Tags className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                                    <span className="text-sm font-medium">No products are waiting for pricing approval.</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : products.map((product) => {
                                        const merchant = profileMap.get(product.merchant_id)
                                        const latestInputs = getLatestInputs(priceInputs, product.id)
                                        const activeSnapshot = snapshotMap.get(product.id)
                                        const defaultApprovedKobo = activeSnapshot?.approved_price_kobo ?? latestInputs.merchant?.amount_kobo ?? product.price ?? 0
                                        return (
                                            <TableRow key={product.id} className="align-top group hover:bg-muted/30 transition-colors">
                                                <TableCell className="px-4 py-4 min-w-[280px]">
                                                    <div className="font-semibold text-foreground">{product.name}</div>
                                                    <div className="text-sm text-muted-foreground mt-0.5">
                                                        {merchant?.company_name || merchant?.full_name || "Merchant"}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                                                        <Badge variant="secondary" className="shadow-sm">{labelize(product.category)}</Badge>
                                                        <Badge variant="outline">Stock {product.stock_level ?? 0}</Badge>
                                                        <Badge variant="outline">Submitted {formatDateTime(product.submitted_for_review_at ?? product.created_at)}</Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-4">
                                                    {latestInputs.merchant ? (
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-foreground">{formatKobo(latestInputs.merchant.amount_kobo)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatDateTime(latestInputs.merchant.created_at)}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/70 font-medium italic">Awaiting merchant input</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-4">
                                                    {latestInputs.agent ? (
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-foreground">{formatKobo(latestInputs.agent.amount_kobo)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatDateTime(latestInputs.agent.created_at)}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/70 font-medium italic">No agent survey yet</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-4">
                                                    {activeSnapshot ? (
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-foreground">{formatKobo(activeSnapshot.approved_price_kobo)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatDateTime(activeSnapshot.approved_at)}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/70 font-medium italic">No active snapshot</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 min-w-[320px]">
                                                    <PricingApprovalControls
                                                        productId={product.id}
                                                        defaultApprovedPriceNaira={koboToNaira(defaultApprovedKobo)}
                                                        defaultInsuranceNaira={koboToNaira(activeSnapshot?.insurance_kobo ?? insuranceDefaultKobo)}
                                                        merchantInputKobo={latestInputs.merchant?.amount_kobo ?? null}
                                                        agentFeeBps={agentFeeBps}
                                                        appFeeBps={appFeeBps}
                                                        opsFeeBps={opsFeeBps}
                                                        vatBps={vatBps}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-blue-500" />
                            Pending Merchants
                        </CardTitle>
                        <CardDescription>Approve merchant onboarding.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {merchants.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center flex flex-col items-center justify-center">
                                <Store className="h-8 w-8 text-muted-foreground/40 mb-3" />
                                <span className="text-sm font-medium text-muted-foreground">No merchant applications are pending.</span>
                            </div>
                        ) : merchants.map((merchant) => {
                            const profile = profileMap.get(merchant.id)

                            return (
                                <div key={merchant.id} className="group relative rounded-xl border border-border/50 p-5 hover:border-blue-500/30 transition-all hover:shadow-md bg-card flex flex-col gap-4">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-foreground">{merchant.store_name}</div>
                                        <div className="text-sm text-muted-foreground font-medium">
                                            {profile?.full_name || "No contact name"}{profile?.phone ? ` • ${profile.phone}` : ""}
                                        </div>
                                        <div className="pt-1 text-sm text-muted-foreground leading-relaxed">
                                            {merchant.business_address || "No business address supplied"}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full pt-1">
                                        <form action={approveMerchantForm} className="flex-1">
                                            <input type="hidden" name="merchant_id" value={merchant.id} />
                                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                                                <CheckCircle2 className="h-4 w-4" /> Approve
                                            </Button>
                                        </form>
                                        <form action={rejectMerchantForm} className="flex-1">
                                            <input type="hidden" name="merchant_id" value={merchant.id} />
                                            <Button type="submit" variant="outline" className="w-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 border-border/60 transition-colors flex items-center justify-center gap-1.5">
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <Bike className="h-5 w-5 text-emerald-500" />
                            Pending Riders
                        </CardTitle>
                        <CardDescription>Approve riders after document review.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {riders.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center flex flex-col items-center justify-center">
                                <Bike className="h-8 w-8 text-muted-foreground/40 mb-3" />
                                <span className="text-sm font-medium text-muted-foreground">No rider applications are pending.</span>
                            </div>
                        ) : riders.map((rider) => {
                            const profile = profileMap.get(rider.id)

                            return (
                                <div key={rider.id} className="group relative rounded-xl border border-border/50 p-5 hover:border-emerald-500/30 transition-all hover:shadow-md bg-card flex flex-col gap-4">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-foreground">{profile?.full_name || "Unnamed rider"}</div>
                                        <div className="text-sm text-muted-foreground font-medium">
                                            {profile?.phone || "No phone provided"}
                                        </div>
                                        <div className="pt-1 text-xs text-muted-foreground font-medium">
                                            Submitted {formatDateTime(rider.created_at)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full pt-1">
                                        <form action={approveRiderForm} className="flex-1">
                                            <input type="hidden" name="rider_id" value={rider.id} />
                                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                                                <CheckCircle2 className="h-4 w-4" /> Approve
                                            </Button>
                                        </form>
                                        <form action={rejectRiderForm} className="flex-1">
                                            <input type="hidden" name="rider_id" value={rider.id} />
                                            <Button type="submit" variant="outline" className="w-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 border-border/60 transition-colors flex items-center justify-center gap-1.5">
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-500" />
                            Pending Agents
                        </CardTitle>
                        <CardDescription>Approve agents after identity review.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {agents.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center flex flex-col items-center justify-center">
                                <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
                                <span className="text-sm font-medium text-muted-foreground">No agent applications are pending.</span>
                            </div>
                        ) : agents.map((agent) => {
                            const profile = profileMap.get(agent.id)

                            return (
                                <div key={agent.id} className="group relative rounded-xl border border-border/50 p-5 hover:border-indigo-500/30 transition-all hover:shadow-md bg-card flex flex-col gap-4">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-foreground">{profile?.full_name || "Unnamed agent"}</div>
                                        <div className="text-sm text-muted-foreground font-medium">
                                            {profile?.phone || "No phone provided"}
                                        </div>
                                        <div className="pt-1 text-sm text-muted-foreground leading-relaxed">
                                            Bank: <span className="text-foreground font-medium">{agent.bank_details?.bankName || "Unknown"}</span>
                                            {agent.bank_details?.accountNumber ? ` • ${agent.bank_details.accountNumber}` : ""}
                                        </div>
                                        <div className="pt-1 text-xs text-muted-foreground font-medium">
                                            Submitted {formatDateTime(agent.created_at)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full pt-1">
                                        <form action={approveAgentForm} className="flex-1">
                                            <input type="hidden" name="agent_id" value={agent.id} />
                                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                                                <CheckCircle2 className="h-4 w-4" /> Approve
                                            </Button>
                                        </form>
                                        <form action={rejectAgentForm} className="flex-1">
                                            <input type="hidden" name="agent_id" value={agent.id} />
                                            <Button type="submit" variant="outline" className="w-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 border-border/60 transition-colors flex items-center justify-center gap-1.5">
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
