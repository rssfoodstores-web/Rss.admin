export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, getOrderStatusClass, getPaymentStatusClass, getSettlementStatusClass, labelize, shortId } from "@/lib/admin-display"
import { formatKobo } from "@/lib/money"
import { cn } from "@/lib/utils"
import { AgentApprovalButtons } from "@/components/dashboard/users/agent-approval-buttons"
import { RiderApprovalButtons } from "@/components/dashboard/users/rider-approval-buttons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PageProps {
    params: Promise<{ id: string }>
}

interface ProfileRow {
    id: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
    updated_at: string | null
    address: string | null
    company_name: string | null
    zip_code: string | null
    state: string | null
    street_address: string | null
    house_number: string | null
    referral_code: string | null
    referred_by: string | null
    points_balance: number | null
    location_locked: boolean | null
    update_requested: boolean | null
    fcm_token: string | null
    location_update_requested_at: string | null
    location_last_verified_at: string | null
}

interface UserRoleRow {
    user_id: string
    role: string
    created_at: string | null
}

interface RiderProfileRow {
    id: string
    status: string | null
    bike_particulars: unknown
    guarantors: unknown
    id_card_url: string | null
    passport_photo_url: string | null
    created_at: string | null
}

interface AgentProfileRow {
    id: string
    bank_details: unknown
    id_card_url: string | null
    guarantors: unknown
    status: string | null
    created_at: string | null
    updated_at: string | null
}

interface MerchantProfileRow {
    id: string
    store_name: string | null
    category: string | null
    store_description: string | null
    business_address: string | null
    status: string | null
    merchant_type: string | null
    kyc_data: unknown
    created_at: string | null
    updated_at: string | null
}

interface WalletRow {
    id: string
    balance: number
    type: string
    created_at: string | null
    virtual_account: unknown
}

interface WalletTransactionRow {
    id: string
    wallet_id: string | null
    amount: number
    type: string | null
    status: string | null
    reference: string | null
    description: string | null
    created_at: string | null
}

interface LedgerEntryRow {
    id: string
    wallet_id: string
    amount: number
    description: string
    reference_id: string | null
    created_at: string | null
}

interface OrderRow {
    id: string
    customer_id: string
    merchant_id: string | null
    assigned_agent_id: string | null
    rider_id: string | null
    total_amount: number
    subtotal_amount_kobo: number | null
    delivery_fee_kobo: number | null
    points_discount_kobo: number | null
    points_redeemed: number | null
    status: string
    payment_status: string | null
    payment_ref: string | null
    created_at: string
}

interface OrderFinancialRow {
    order_id: string
    merchant_base_total_kobo: number
    agent_fee_total_kobo: number
    rider_share_kobo: number
    app_fee_total_kobo: number
    ops_fee_total_kobo: number
    insurance_total_kobo: number
    grand_total_kobo: number
    settlement_status: string | null
    settled_at: string | null
}

interface GiftCardRow {
    id: string
    code: string
    purchaser_id: string
    recipient_id: string | null
    recipient_email: string | null
    amount_kobo: number
    remaining_amount_kobo: number
    payment_method: string | null
    payment_reference: string | null
    message: string | null
    status: string
    delivered_at: string | null
    expires_at: string | null
    last_used_at: string | null
    created_at: string
    updated_at: string | null
}

interface GiftCardTransactionRow {
    id: string
    gift_card_id: string
    actor_id: string | null
    transaction_type: string
    amount_kobo: number
    reference: string | null
    description: string | null
    created_at: string | null
}

interface RewardBalanceRow {
    user_id: string
    available_points: number
    pending_points: number
    debt_points: number
    updated_at: string | null
    created_at: string | null
}

interface RewardEventRow {
    id: string
    event_type: string
    points_delta: number
    description: string
    source_kind: string | null
    available_balance_after: number
    pending_balance_after: number
    debt_balance_after: number
    created_at: string | null
}

interface ReferralCommissionRow {
    id: string
    source_kind: string
    source_amount_kobo: number
    commission_amount_kobo: number
    created_at: string | null
}

interface ReferredProfileRow {
    id: string
    full_name: string | null
    phone: string | null
    company_name: string | null
    updated_at: string | null
}

interface SupportConversationRow {
    id: string
    user_id: string
    subject: string | null
    channel: string | null
    status: string | null
    resolved_by_ai: boolean | null
    escalated_to_human: boolean | null
    last_message_at: string | null
    last_message_preview: string | null
    created_at: string | null
    updated_at: string | null
}

type OrderInvolvement = "customer" | "merchant" | "agent" | "rider"

interface RelatedOrder extends OrderRow {
    involvements: OrderInvolvement[]
    financial: OrderFinancialRow | null
}

interface ActivityItem {
    id: string
    title: string
    detail: string
    createdAt: string | null
    href?: string
}

function getInitials(value: string | null | undefined) {
    if (!value) {
        return "U"
    }

    return value
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "U"
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

function getText(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function getRecordText(record: Record<string, unknown> | null, key: string) {
    return getText(record?.[key])
}

function formatSignedKobo(amountKobo: number | null | undefined) {
    const amount = amountKobo ?? 0

    if (amount > 0) {
        return `+${formatKobo(amount)}`
    }

    return formatKobo(amount)
}

function buildAddress(profile: ProfileRow) {
    const structured = [
        profile.house_number,
        profile.street_address,
        profile.state,
        profile.zip_code,
    ].filter(Boolean).join(", ")

    return profile.address?.trim() || structured || "No address on file"
}

function getRoleTone(role: string) {
    switch (role) {
        case "supa_admin":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        case "admin":
        case "sub_admin":
            return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
        case "merchant":
            return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
        case "agent":
            return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        case "rider":
            return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    }
}

function getGenericStatusTone(status: string | null | undefined) {
    switch (status) {
        case "approved":
        case "active":
        case "completed":
        case "resolved":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        case "pending":
        case "processing":
        case "open":
        case "investigating":
            return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
        case "rejected":
        case "failed":
        case "cancelled":
        case "expired":
        case "locked":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    }
}

function getWalletLabel(type: string) {
    switch (type) {
        case "customer":
            return "Customer Wallet"
        case "merchant":
            return "Merchant Wallet"
        case "agent":
            return "Agent Wallet"
        case "rider":
            return "Rider Wallet"
        case "commission":
            return "Commission Wallet"
        default:
            return `${labelize(type)} Wallet`
    }
}

function getWalletDescription(type: string) {
    switch (type) {
        case "customer":
            return "Customer spendable balance and top-up account."
        case "merchant":
            return "Operational merchant settlement balance."
        case "agent":
            return "Operational agent earnings balance."
        case "rider":
            return "Operational rider earnings balance."
        case "commission":
            return "Referral or commission settlement balance."
        default:
            return "Operational wallet."
    }
}

function getWalletAccountDetails(wallet: WalletRow) {
    const virtualAccount = asRecord(wallet.virtual_account)

    return {
        bankName: getRecordText(virtualAccount, "bankName"),
        accountNumber: getRecordText(virtualAccount, "accountNumber"),
        accountName: getRecordText(virtualAccount, "accountName"),
    }
}

function getPrimaryRole(roles: string[]) {
    const priority = ["supa_admin", "admin", "sub_admin", "merchant", "agent", "rider", "customer"]

    for (const role of priority) {
        if (roles.includes(role)) {
            return role
        }
    }

    return roles[0] ?? "customer"
}

function mergeRecentOrders(groups: Record<OrderInvolvement, OrderRow[]>, financialMap: Map<string, OrderFinancialRow>) {
    const merged = new Map<string, RelatedOrder>()

    for (const [involvement, orders] of Object.entries(groups) as [OrderInvolvement, OrderRow[]][]) {
        for (const order of orders) {
            const existing = merged.get(order.id)

            if (existing) {
                if (!existing.involvements.includes(involvement)) {
                    existing.involvements.push(involvement)
                }
                continue
            }

            merged.set(order.id, {
                ...order,
                involvements: [involvement],
                financial: financialMap.get(order.id) ?? null,
            })
        }
    }

    return Array.from(merged.values())
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 10)
}

function isOpenSupportStatus(status: string | null | undefined) {
    return !["resolved", "closed", "archived"].includes(String(status ?? "").toLowerCase())
}

function getMerchantDocumentEntries(merchantProfile: MerchantProfileRow | null) {
    const kyc = asRecord(merchantProfile?.kyc_data)
    const documents = asRecord(kyc?.documents)

    if (!documents) {
        return []
    }

    return Object.entries(documents)
        .map(([key, value]) => {
            const url = getText(value)

            if (!url) {
                return null
            }

            return {
                key,
                label: labelize(key),
                url,
            }
        })
        .filter((entry): entry is { key: string; label: string; url: string } => Boolean(entry))
}

function buildOrderHref(orderId: string) {
    const params = new URLSearchParams({ q: orderId })

    return `/dashboard/orders?${params.toString()}`
}

function buildOverviewActivity(
    walletTransactions: WalletTransactionRow[],
    rewardEvents: RewardEventRow[],
    giftCardTransactions: GiftCardTransactionRow[],
    supportConversations: SupportConversationRow[],
    relatedOrders: RelatedOrder[]
) {
    const items: ActivityItem[] = [
        ...walletTransactions.slice(0, 3).map((transaction) => ({
            id: `wallet-${transaction.id}`,
            title: `${labelize(transaction.type ?? "activity")} on wallet`,
            detail: `${formatSignedKobo(transaction.amount)} · ${transaction.description || transaction.reference || "No memo"}`,
            createdAt: transaction.created_at,
        })),
        ...rewardEvents.slice(0, 2).map((event) => ({
            id: `reward-${event.id}`,
            title: `Reward ${labelize(event.event_type)}`,
            detail: `${event.points_delta > 0 ? "+" : ""}${event.points_delta} pts · ${event.description}`,
            createdAt: event.created_at,
        })),
        ...giftCardTransactions.slice(0, 2).map((transaction) => ({
            id: `gift-${transaction.id}`,
            title: `Gift card ${labelize(transaction.transaction_type)}`,
            detail: `${formatKobo(transaction.amount_kobo)} · ${transaction.description || transaction.reference || "No memo"}`,
            createdAt: transaction.created_at,
        })),
        ...supportConversations.slice(0, 2).map((conversation) => ({
            id: `support-${conversation.id}`,
            title: `Support ${labelize(conversation.status ?? "open")}`,
            detail: conversation.subject || conversation.last_message_preview || "No subject",
            createdAt: conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at,
        })),
        ...relatedOrders.slice(0, 3).map((order) => ({
            id: `order-${order.id}`,
            title: `Order #${shortId(order.id, 10)}`,
            detail: `${formatKobo(order.total_amount)} · ${order.involvements.map(labelize).join(", ")}`,
            createdAt: order.created_at,
            href: buildOrderHref(order.id),
        })),
    ]

    return items
        .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
        .slice(0, 8)
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{title}</div>
            <div className="mt-1">{description}</div>
        </div>
    )
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
    return (
        <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
                <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{helper}</div>
            </CardContent>
        </Card>
    )
}

function DetailListItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-b-0 last:pb-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-medium text-foreground">{value}</span>
        </div>
    )
}

function SupportMetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{helper}</div>
        </div>
    )
}

export default async function UserProfilePage({ params }: PageProps) {
    const access = await requireAdminRouteAccess("accounts")
    const { id } = await params
    const supabase = access.supabase

    const [
        profileResult,
        userRolesResult,
        riderResult,
        agentResult,
        merchantResult,
        walletsResult,
        customerOrderCountResult,
        merchantOrderCountResult,
        agentOrderCountResult,
        riderOrderCountResult,
        customerRecentOrdersResult,
        merchantRecentOrdersResult,
        agentRecentOrdersResult,
        riderRecentOrdersResult,
        rewardBalanceResult,
        rewardEventsResult,
        giftCardsPurchasedResult,
        giftCardsReceivedResult,
        referralCommissionsResult,
        referredUsersResult,
        supportConversationsResult,
    ] = await Promise.all([
        supabase
            .from("profiles")
            .select("id, full_name, phone, avatar_url, updated_at, address, company_name, zip_code, state, street_address, house_number, referral_code, referred_by, points_balance, location_locked, update_requested, fcm_token, location_update_requested_at, location_last_verified_at")
            .eq("id", id)
            .maybeSingle(),
        supabase
            .from("user_roles")
            .select("user_id, role, created_at")
            .eq("user_id", id)
            .order("created_at", { ascending: true }),
        supabase
            .from("rider_profiles")
            .select("id, status, bike_particulars, guarantors, id_card_url, passport_photo_url, created_at")
            .eq("id", id)
            .maybeSingle(),
        supabase
            .from("agent_profiles")
            .select("id, bank_details, id_card_url, guarantors, status, created_at, updated_at")
            .eq("id", id)
            .maybeSingle(),
        supabase
            .from("merchants")
            .select("id, store_name, category, store_description, business_address, status, merchant_type, kyc_data, created_at, updated_at")
            .eq("id", id)
            .maybeSingle(),
        supabase
            .from("wallets")
            .select("id, balance, type, created_at, virtual_account")
            .eq("owner_id", id)
            .order("created_at", { ascending: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("merchant_id", id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("assigned_agent_id", id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("rider_id", id),
        supabase
            .from("orders")
            .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, total_amount, subtotal_amount_kobo, delivery_fee_kobo, points_discount_kobo, points_redeemed, status, payment_status, payment_ref, created_at")
            .eq("customer_id", id)
            .order("created_at", { ascending: false })
            .limit(6),
        supabase
            .from("orders")
            .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, total_amount, subtotal_amount_kobo, delivery_fee_kobo, points_discount_kobo, points_redeemed, status, payment_status, payment_ref, created_at")
            .eq("merchant_id", id)
            .order("created_at", { ascending: false })
            .limit(6),
        supabase
            .from("orders")
            .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, total_amount, subtotal_amount_kobo, delivery_fee_kobo, points_discount_kobo, points_redeemed, status, payment_status, payment_ref, created_at")
            .eq("assigned_agent_id", id)
            .order("created_at", { ascending: false })
            .limit(6),
        supabase
            .from("orders")
            .select("id, customer_id, merchant_id, assigned_agent_id, rider_id, total_amount, subtotal_amount_kobo, delivery_fee_kobo, points_discount_kobo, points_redeemed, status, payment_status, payment_ref, created_at")
            .eq("rider_id", id)
            .order("created_at", { ascending: false })
            .limit(6),
        supabase
            .from("reward_point_balances")
            .select("user_id, available_points, pending_points, debt_points, updated_at, created_at")
            .eq("user_id", id)
            .maybeSingle(),
        supabase
            .from("reward_point_events")
            .select("id, event_type, points_delta, description, source_kind, available_balance_after, pending_balance_after, debt_balance_after, created_at")
            .eq("user_id", id)
            .order("created_at", { ascending: false })
            .limit(8),
        supabase
            .from("gift_cards")
            .select("id, code, purchaser_id, recipient_id, recipient_email, amount_kobo, remaining_amount_kobo, payment_method, payment_reference, message, status, delivered_at, expires_at, last_used_at, created_at, updated_at")
            .eq("purchaser_id", id)
            .order("created_at", { ascending: false }),
        supabase
            .from("gift_cards")
            .select("id, code, purchaser_id, recipient_id, recipient_email, amount_kobo, remaining_amount_kobo, payment_method, payment_reference, message, status, delivered_at, expires_at, last_used_at, created_at, updated_at")
            .eq("recipient_id", id)
            .order("created_at", { ascending: false }),
        supabase
            .from("referral_commissions")
            .select("id, source_kind, source_amount_kobo, commission_amount_kobo, created_at")
            .eq("referrer_id", id)
            .order("created_at", { ascending: false }),
        supabase
            .from("profiles")
            .select("id, full_name, phone, company_name, updated_at")
            .eq("referred_by", id)
            .order("updated_at", { ascending: false }),
        supabase
            .from("support_conversations")
            .select("id, user_id, subject, channel, status, resolved_by_ai, escalated_to_human, last_message_at, last_message_preview, created_at, updated_at")
            .eq("user_id", id)
            .order("updated_at", { ascending: false }),
    ])

    const profile = (profileResult.data ?? null) as ProfileRow | null

    if (!profile) {
        console.error("UserProfilePage: profile not found", profileResult.error)
        return notFound()
    }

    const roleRows = (userRolesResult.data ?? []) as UserRoleRow[]
    const riderProfile = (riderResult.data ?? null) as RiderProfileRow | null
    const agentProfile = (agentResult.data ?? null) as AgentProfileRow | null
    const merchantProfile = (merchantResult.data ?? null) as MerchantProfileRow | null
    const wallets = (walletsResult.data ?? []) as WalletRow[]
    const rewardBalance = (rewardBalanceResult.data ?? null) as RewardBalanceRow | null
    const rewardEvents = (rewardEventsResult.data ?? []) as RewardEventRow[]
    const giftCardsPurchased = (giftCardsPurchasedResult.data ?? []) as GiftCardRow[]
    const giftCardsReceived = (giftCardsReceivedResult.data ?? []) as GiftCardRow[]
    const referralCommissions = (referralCommissionsResult.data ?? []) as ReferralCommissionRow[]
    const referredUsers = (referredUsersResult.data ?? []) as ReferredProfileRow[]
    const supportConversations = (supportConversationsResult.data ?? []) as SupportConversationRow[]
    const customerRecentOrders = (customerRecentOrdersResult.data ?? []) as OrderRow[]
    const merchantRecentOrders = (merchantRecentOrdersResult.data ?? []) as OrderRow[]
    const agentRecentOrders = (agentRecentOrdersResult.data ?? []) as OrderRow[]
    const riderRecentOrders = (riderRecentOrdersResult.data ?? []) as OrderRow[]

    const walletIds = wallets.map((wallet) => wallet.id)
    const recentGiftCardIds = Array.from(
        new Set([...giftCardsPurchased.slice(0, 12), ...giftCardsReceived.slice(0, 12)].map((card) => card.id))
    )
    const recentOrderIds = Array.from(
        new Set(
            [
                ...customerRecentOrders,
                ...merchantRecentOrders,
                ...agentRecentOrders,
                ...riderRecentOrders,
            ].map((order) => order.id)
        )
    )

    const [
        walletTransactionsResult,
        ledgerEntriesResult,
        giftCardTransactionsResult,
        orderFinancialsResult,
        referredByProfileResult,
    ] = await Promise.all([
        walletIds.length > 0
            ? supabase
                .from("wallet_transactions")
                .select("id, wallet_id, amount, type, status, reference, description, created_at")
                .in("wallet_id", walletIds)
                .order("created_at", { ascending: false })
                .limit(12)
            : Promise.resolve({ data: [] as WalletTransactionRow[], error: null }),
        walletIds.length > 0
            ? supabase
                .from("ledger_entries")
                .select("id, wallet_id, amount, description, reference_id, created_at")
                .in("wallet_id", walletIds)
                .order("created_at", { ascending: false })
                .limit(12)
            : Promise.resolve({ data: [] as LedgerEntryRow[], error: null }),
        recentGiftCardIds.length > 0
            ? supabase
                .from("gift_card_transactions")
                .select("id, gift_card_id, actor_id, transaction_type, amount_kobo, reference, description, created_at")
                .in("gift_card_id", recentGiftCardIds)
                .order("created_at", { ascending: false })
                .limit(12)
            : Promise.resolve({ data: [] as GiftCardTransactionRow[], error: null }),
        recentOrderIds.length > 0
            ? supabase
                .from("order_financials")
                .select("order_id, merchant_base_total_kobo, agent_fee_total_kobo, rider_share_kobo, app_fee_total_kobo, ops_fee_total_kobo, insurance_total_kobo, grand_total_kobo, settlement_status, settled_at")
                .in("order_id", recentOrderIds)
            : Promise.resolve({ data: [] as OrderFinancialRow[], error: null }),
        profile.referred_by
            ? supabase
                .from("profiles")
                .select("id, full_name, phone, company_name, updated_at")
                .eq("id", profile.referred_by)
                .maybeSingle()
            : Promise.resolve({ data: null as ReferredProfileRow | null, error: null }),
    ])

    const walletTransactions = (walletTransactionsResult.data ?? []) as WalletTransactionRow[]
    const ledgerEntries = (ledgerEntriesResult.data ?? []) as LedgerEntryRow[]
    const giftCardTransactions = (giftCardTransactionsResult.data ?? []) as GiftCardTransactionRow[]
    const orderFinancials = (orderFinancialsResult.data ?? []) as OrderFinancialRow[]
    const referredByProfile = (referredByProfileResult.data ?? null) as ReferredProfileRow | null

    const financialMap = new Map(orderFinancials.map((item) => [item.order_id, item]))
    const relatedOrders = mergeRecentOrders(
        {
            customer: customerRecentOrders,
            merchant: merchantRecentOrders,
            agent: agentRecentOrders,
            rider: riderRecentOrders,
        },
        financialMap
    )

    const explicitRoles = roleRows.map((row) => row.role)
    const inferredRoles = [
        agentProfile ? "agent" : null,
        riderProfile ? "rider" : null,
        merchantProfile ? "merchant" : null,
    ].filter((value): value is string => Boolean(value))
    const roles = Array.from(new Set([...explicitRoles, ...inferredRoles]))

    if (roles.length === 0) {
        roles.push("customer")
    }

    const primaryRole = getPrimaryRole(roles)
    const totalWalletBalance = wallets.reduce((sum, wallet) => sum + (wallet.balance ?? 0), 0)
    const totalOrderTouchpoints =
        (customerOrderCountResult.count ?? 0) +
        (merchantOrderCountResult.count ?? 0) +
        (agentOrderCountResult.count ?? 0) +
        (riderOrderCountResult.count ?? 0)
    const purchasedGiftCardValueKobo = giftCardsPurchased.reduce((sum, card) => sum + (card.amount_kobo ?? 0), 0)
    const receivedGiftCardRemainingKobo = giftCardsReceived.reduce((sum, card) => sum + (card.remaining_amount_kobo ?? 0), 0)
    const referralCommissionTotalKobo = referralCommissions.reduce((sum, item) => sum + (item.commission_amount_kobo ?? 0), 0)
    const openSupportCount = supportConversations.filter((conversation) => isOpenSupportStatus(conversation.status)).length
    const escalatedSupportCount = supportConversations.filter((conversation) => conversation.escalated_to_human).length
    const overviewActivity = buildOverviewActivity(walletTransactions, rewardEvents, giftCardTransactions, supportConversations, relatedOrders)
    const customerWallet = wallets.find((wallet) => wallet.type === "customer") ?? null
    const operationalWallets = wallets.filter((wallet) => wallet.type !== "customer")
    const merchantDocuments = getMerchantDocumentEntries(merchantProfile)

    const agentBankDetails = asRecord(agentProfile?.bank_details)
    const agentGuarantors = asRecord(agentProfile?.guarantors)
    const riderBikeParticulars = asRecord(riderProfile?.bike_particulars)
    const riderGuarantors = asRecord(riderProfile?.guarantors)
    const merchantKyc = asRecord(merchantProfile?.kyc_data)

    return (
        <div className="flex flex-col gap-6 pb-10">
            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border/70 bg-muted">
                            {profile.avatar_url ? (
                                <Image src={profile.avatar_url} alt={profile.full_name || "User"} fill className="object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
                                    {getInitials(profile.full_name)}
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.full_name || "Unknown user"}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {roles.map((role) => (
                                        <Badge key={role} variant="outline" className={cn("capitalize", getRoleTone(role))}>
                                            {role === "supa_admin" ? "Super Admin" : labelize(role)}
                                        </Badge>
                                    ))}
                                    {profile.location_locked ? (
                                        <Badge variant="outline" className={cn("capitalize", getGenericStatusTone("locked"))}>
                                            Location locked
                                        </Badge>
                                    ) : null}
                                    {profile.update_requested ? (
                                        <Badge variant="outline" className={cn("capitalize", getGenericStatusTone("pending"))}>
                                            Update requested
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span>User ID {shortId(profile.id, 12)}</span>
                                <span>Profile updated {formatDateTime(profile.updated_at)}</span>
                                <span>Primary role {labelize(primaryRole)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline" className="shadow-sm">
                            <Link href={`/dashboard/orders?q=${profile.id}`}>Search orders</Link>
                        </Button>
                        <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
                            <Link href={`/dashboard/notifications?userId=${profile.id}`}>Send notification</Link>
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
                    {[
                        { value: "overview", label: "Overview" },
                        { value: "wallets", label: "Wallets" },
                        { value: "orders", label: "Orders" },
                        { value: "gift-cards", label: "Gift Cards" },
                        { value: "rewards-referrals", label: "Rewards & Referrals" },
                        { value: "support", label: "Support" },
                    ].map((item) => (
                        <TabsTrigger
                            key={item.value}
                            value={item.value}
                            className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950/20 dark:data-[state=active]:text-orange-300"
                        >
                            {item.label}
                        </TabsTrigger>
                    ))}
                    {agentProfile ? (
                        <TabsTrigger value="agent" className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950/20 dark:data-[state=active]:text-orange-300">
                            Agent profile
                        </TabsTrigger>
                    ) : null}
                    {riderProfile ? (
                        <TabsTrigger value="rider" className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950/20 dark:data-[state=active]:text-orange-300">
                            Rider profile
                        </TabsTrigger>
                    ) : null}
                    {merchantProfile ? (
                        <TabsTrigger value="merchant" className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950/20 dark:data-[state=active]:text-orange-300">
                            Merchant profile
                        </TabsTrigger>
                    ) : null}
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            title="Wallet balance"
                            value={formatKobo(totalWalletBalance)}
                            helper={`${wallets.length} wallet${wallets.length === 1 ? "" : "s"} in this account`}
                        />
                        <MetricCard
                            title="Order touchpoints"
                            value={String(totalOrderTouchpoints)}
                            helper={`Customer ${customerOrderCountResult.count ?? 0} · Merchant ${merchantOrderCountResult.count ?? 0} · Agent ${agentOrderCountResult.count ?? 0} · Rider ${riderOrderCountResult.count ?? 0}`}
                        />
                        <MetricCard
                            title="Gift card movement"
                            value={formatKobo(purchasedGiftCardValueKobo)}
                            helper={`${giftCardsPurchased.length} purchased · ${giftCardsReceived.length} received`}
                        />
                        <MetricCard
                            title="Referral earnings"
                            value={formatKobo(referralCommissionTotalKobo)}
                            helper={`${referredUsers.length} referred user${referredUsers.length === 1 ? "" : "s"} · ${openSupportCount} open support thread${openSupportCount === 1 ? "" : "s"}`}
                        />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Account snapshot</CardTitle>
                                <CardDescription>Core admin context for this user account.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                <DetailListItem label="Phone" value={profile.phone || "No phone on file"} />
                                <DetailListItem label="Address" value={buildAddress(profile)} />
                                <DetailListItem label="Referral code" value={profile.referral_code || "Not generated"} />
                                <DetailListItem
                                    label="Referred by"
                                    value={referredByProfile?.full_name || referredByProfile?.company_name || shortId(profile.referred_by) || "Direct signup"}
                                />
                                <DetailListItem label="Push notifications" value={profile.fcm_token ? "Token present" : "No device token"} />
                                <DetailListItem label="Customer wallet" value={customerWallet ? formatKobo(customerWallet.balance) : "Not provisioned"} />
                                <DetailListItem label="Operational wallets" value={String(operationalWallets.length)} />
                                <DetailListItem label="Location last verified" value={formatDateTime(profile.location_last_verified_at)} />
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Operational status</CardTitle>
                                <CardDescription>Approval, support, and monitoring signals.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <SupportMetricCard
                                    title="Merchant"
                                    value={labelize(merchantProfile?.status ?? "none")}
                                    helper={merchantProfile ? `Submitted ${formatDateTime(merchantProfile.created_at)}` : "No merchant workspace"}
                                />
                                <SupportMetricCard
                                    title="Agent"
                                    value={labelize(agentProfile?.status ?? "none")}
                                    helper={agentProfile ? `Submitted ${formatDateTime(agentProfile.created_at)}` : "No agent workspace"}
                                />
                                <SupportMetricCard
                                    title="Rider"
                                    value={labelize(riderProfile?.status ?? "none")}
                                    helper={riderProfile ? `Submitted ${formatDateTime(riderProfile.created_at)}` : "No rider workspace"}
                                />
                                <SupportMetricCard
                                    title="Support"
                                    value={`${openSupportCount}/${supportConversations.length}`}
                                    helper={`${escalatedSupportCount} escalated to human`}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <CardTitle>Latest activity</CardTitle>
                            <CardDescription>The most recent money, support, reward, and order events tied to this account.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {overviewActivity.length === 0 ? (
                                <EmptyState title="No recent activity" description="This user has no wallet, reward, support, or order activity yet." />
                            ) : (
                                <div className="space-y-3">
                                    {overviewActivity.map((activity) => (
                                        <div key={activity.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-1">
                                                <div className="font-medium text-foreground">{activity.title}</div>
                                                <div className="text-sm text-muted-foreground">{activity.detail}</div>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span>{formatDateTime(activity.createdAt)}</span>
                                                {activity.href ? (
                                                    <Button asChild variant="ghost" size="sm" className="h-auto px-2 py-1 text-orange-600 hover:text-orange-700">
                                                        <Link href={activity.href}>Open</Link>
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="wallets" className="mt-6 space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {wallets.length === 0 ? (
                            <div className="lg:col-span-2 xl:col-span-3">
                                <EmptyState title="No wallets provisioned" description="This account does not yet have a customer or operational wallet in the system." />
                            </div>
                        ) : wallets.map((wallet) => {
                            const account = getWalletAccountDetails(wallet)

                            return (
                                <Card key={wallet.id} className="border-border/60 shadow-sm">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-lg">{getWalletLabel(wallet.type)}</CardTitle>
                                                <CardDescription>{getWalletDescription(wallet.type)}</CardDescription>
                                            </div>
                                            <Badge variant="outline" className={cn("capitalize", getRoleTone(wallet.type))}>
                                                {labelize(wallet.type)}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Balance</div>
                                            <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatKobo(wallet.balance)}</div>
                                        </div>
                                        <Separator />
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Wallet ID</span>
                                                <span className="font-medium text-foreground">{shortId(wallet.id, 12)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Created</span>
                                                <span className="font-medium text-foreground">{formatDateTime(wallet.created_at)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Top-up account</span>
                                                <span className="font-medium text-foreground">{account.accountNumber ? "Available" : "Not assigned"}</span>
                                            </div>
                                        </div>
                                        {account.accountNumber ? (
                                            <div className="rounded-2xl bg-muted/40 p-4">
                                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Virtual account</div>
                                                <div className="mt-2 font-semibold text-foreground">{account.bankName || "Bank not set"}</div>
                                                <div className="mt-1 font-mono text-lg text-foreground">{account.accountNumber}</div>
                                                <div className="text-sm text-muted-foreground">{account.accountName || "Account name unavailable"}</div>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Recent wallet transactions</CardTitle>
                                <CardDescription>Top-up, withdrawal, and bank-linked transaction attempts.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {walletTransactions.length === 0 ? (
                                    <EmptyState title="No wallet transactions" description="No customer top-ups or withdrawal transactions have been logged yet." />
                                ) : (
                                    <div className="space-y-3">
                                        {walletTransactions.map((transaction) => (
                                            <div key={transaction.id} className="rounded-2xl border border-border/60 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-foreground">{labelize(transaction.type ?? "activity")}</div>
                                                        <div className="text-sm text-muted-foreground">{transaction.description || transaction.reference || "No description recorded."}</div>
                                                    </div>
                                                    <div className="space-y-1 text-left sm:text-right">
                                                        <div className={cn("font-semibold", transaction.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                                            {formatSignedKobo(transaction.amount)}
                                                        </div>
                                                        <Badge variant="outline" className={cn("capitalize", getGenericStatusTone(transaction.status))}>
                                                            {labelize(transaction.status ?? "unknown")}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-muted-foreground">
                                                    Wallet {shortId(transaction.wallet_id)} · {formatDateTime(transaction.created_at)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Ledger movement</CardTitle>
                                <CardDescription>System-posted balance changes after settlements, spends, and adjustments.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {ledgerEntries.length === 0 ? (
                                    <EmptyState title="No ledger entries" description="There are no posted wallet ledger entries for this account yet." />
                                ) : (
                                    <div className="space-y-3">
                                        {ledgerEntries.map((entry) => (
                                            <div key={entry.id} className="rounded-2xl border border-border/60 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-foreground">{entry.description}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Wallet {shortId(entry.wallet_id)}{entry.reference_id ? ` · Ref ${shortId(entry.reference_id, 12)}` : ""}
                                                        </div>
                                                    </div>
                                                    <div className={cn("font-semibold", entry.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                                        {formatSignedKobo(entry.amount)}
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Customer orders" value={String(customerOrderCountResult.count ?? 0)} helper="Orders placed as a buyer." />
                        <MetricCard title="Merchant orders" value={String(merchantOrderCountResult.count ?? 0)} helper="Orders tied to the merchant workspace." />
                        <MetricCard title="Agent orders" value={String(agentOrderCountResult.count ?? 0)} helper="Orders where this account handled the sourcing role." />
                        <MetricCard title="Rider orders" value={String(riderOrderCountResult.count ?? 0)} helper="Orders delivered by this rider account." />
                    </div>

                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <CardTitle>Recent related orders</CardTitle>
                            <CardDescription>Latest order records where this user appeared as customer, merchant, agent, or rider.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {relatedOrders.length === 0 ? (
                                <EmptyState title="No order history" description="This account has not been attached to any order role yet." />
                            ) : (
                                <div className="space-y-4">
                                    {relatedOrders.map((order) => (
                                        <div key={order.id} className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="font-semibold text-foreground">Order #{shortId(order.id, 10)}</div>
                                                        {order.involvements.map((involvement) => (
                                                            <Badge key={involvement} variant="outline" className={cn("capitalize", getRoleTone(involvement))}>
                                                                {labelize(involvement)}
                                                            </Badge>
                                                        ))}
                                                        <Badge variant="outline" className={cn(getOrderStatusClass(order.status))}>
                                                            {labelize(order.status)}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn(getPaymentStatusClass(order.payment_status))}>
                                                            {labelize(order.payment_status ?? "pending")}
                                                        </Badge>
                                                        {order.financial?.settlement_status ? (
                                                            <Badge variant="outline" className={cn(getSettlementStatusClass(order.financial.settlement_status))}>
                                                                Settlement {labelize(order.financial.settlement_status)}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Created {formatDateTime(order.created_at)}
                                                        {order.payment_ref ? ` · Payment ref ${order.payment_ref}` : ""}
                                                    </div>
                                                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                                                        <div>Total {formatKobo(order.total_amount)}</div>
                                                        <div>Subtotal {formatKobo(order.subtotal_amount_kobo ?? 0)}</div>
                                                        <div>Delivery {formatKobo(order.delivery_fee_kobo ?? 0)}</div>
                                                        <div>Points redeemed {order.points_redeemed ?? 0} ({formatKobo(order.points_discount_kobo ?? 0)})</div>
                                                    </div>
                                                    {order.financial ? (
                                                        <div className="grid gap-2 rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground md:grid-cols-2">
                                                            <div>Merchant base {formatKobo(order.financial.merchant_base_total_kobo)}</div>
                                                            <div>Agent fee {formatKobo(order.financial.agent_fee_total_kobo)}</div>
                                                            <div>Rider share {formatKobo(order.financial.rider_share_kobo)}</div>
                                                            <div>Platform revenue {formatKobo((order.financial.app_fee_total_kobo ?? 0) + (order.financial.ops_fee_total_kobo ?? 0) + (order.financial.insurance_total_kobo ?? 0))}</div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <Button asChild variant="outline" className="w-full lg:w-auto">
                                                    <Link href={buildOrderHref(order.id)}>Open order</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gift-cards" className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Purchased" value={String(giftCardsPurchased.length)} helper={formatKobo(purchasedGiftCardValueKobo)} />
                        <MetricCard title="Received" value={String(giftCardsReceived.length)} helper={formatKobo(receivedGiftCardRemainingKobo)} />
                        <MetricCard title="Available value" value={formatKobo(receivedGiftCardRemainingKobo)} helper="Remaining amount on cards assigned to this user." />
                        <MetricCard title="Gift activity" value={String(giftCardTransactions.length)} helper="Recent gift card transactions in loaded cards." />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Purchased gift cards</CardTitle>
                                <CardDescription>Cards this user funded or created for others.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {giftCardsPurchased.length === 0 ? (
                                    <EmptyState title="No purchased gift cards" description="This account has not bought any gift cards yet." />
                                ) : (
                                    <div className="space-y-3">
                                        {giftCardsPurchased.slice(0, 8).map((card) => (
                                            <div key={card.id} className="rounded-2xl border border-border/60 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-foreground">{card.code}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {card.recipient_email || (card.recipient_id ? `Recipient ${shortId(card.recipient_id, 12)}` : "Recipient not assigned")}
                                                        </div>
                                                        {card.message ? <div className="text-sm text-muted-foreground">{card.message}</div> : null}
                                                    </div>
                                                    <div className="space-y-1 text-left sm:text-right">
                                                        <div className="font-semibold text-foreground">{formatKobo(card.amount_kobo)}</div>
                                                        <Badge variant="outline" className={cn(getGenericStatusTone(card.status))}>
                                                            {labelize(card.status)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-muted-foreground">
                                                    Remaining {formatKobo(card.remaining_amount_kobo)} · Created {formatDateTime(card.created_at)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Received gift cards</CardTitle>
                                <CardDescription>Cards assigned directly to this user account.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {giftCardsReceived.length === 0 ? (
                                    <EmptyState title="No received gift cards" description="No gift cards have been delivered to this account yet." />
                                ) : (
                                    <div className="space-y-3">
                                        {giftCardsReceived.slice(0, 8).map((card) => (
                                            <div key={card.id} className="rounded-2xl border border-border/60 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-foreground">{card.code}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Delivered {formatDateTime(card.delivered_at || card.created_at)}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Expires {formatDateTime(card.expires_at)}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 text-left sm:text-right">
                                                        <div className="font-semibold text-foreground">{formatKobo(card.remaining_amount_kobo)}</div>
                                                        <Badge variant="outline" className={cn(getGenericStatusTone(card.status))}>
                                                            {labelize(card.status)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-muted-foreground">
                                                    Face value {formatKobo(card.amount_kobo)}{card.last_used_at ? ` · Last used ${formatDateTime(card.last_used_at)}` : ""}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <CardTitle>Recent gift card transactions</CardTitle>
                            <CardDescription>Spend and balance movements on recent cards tied to this user.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {giftCardTransactions.length === 0 ? (
                                <EmptyState title="No transaction history" description="No gift card debits or credits have been recorded yet." />
                            ) : (
                                <div className="space-y-3">
                                    {giftCardTransactions.map((transaction) => (
                                        <div key={transaction.id} className="rounded-2xl border border-border/60 p-4">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="space-y-1">
                                                    <div className="font-medium text-foreground">{labelize(transaction.transaction_type)}</div>
                                                    <div className="text-sm text-muted-foreground">{transaction.description || transaction.reference || "No description recorded."}</div>
                                                </div>
                                                <div className="font-semibold text-foreground">{formatKobo(transaction.amount_kobo)}</div>
                                            </div>
                                            <div className="mt-3 text-xs text-muted-foreground">
                                                Card {shortId(transaction.gift_card_id, 12)} · {formatDateTime(transaction.created_at)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rewards-referrals" className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Available points" value={String(rewardBalance?.available_points ?? 0)} helper={`Profile balance ${profile.points_balance ?? 0}`} />
                        <MetricCard title="Pending points" value={String(rewardBalance?.pending_points ?? 0)} helper="Points not yet matured for checkout." />
                        <MetricCard title="Debt points" value={String(rewardBalance?.debt_points ?? 0)} helper="Negative balance adjustments or clawbacks." />
                        <MetricCard title="Referral earnings" value={formatKobo(referralCommissionTotalKobo)} helper={`${referralCommissions.length} commission event${referralCommissions.length === 1 ? "" : "s"}`} />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Reward history</CardTitle>
                                <CardDescription>Recent points issuance, redemptions, and adjustments.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {rewardEvents.length === 0 ? (
                                    <EmptyState title="No reward events" description="No points have been issued or redeemed for this account yet." />
                                ) : (
                                    <div className="space-y-3">
                                        {rewardEvents.map((event) => (
                                            <div key={event.id} className="rounded-2xl border border-border/60 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-foreground">{labelize(event.event_type)}</div>
                                                        <div className="text-sm text-muted-foreground">{event.description}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Source {labelize(event.source_kind ?? "manual")} · Available {event.available_balance_after} pts
                                                        </div>
                                                    </div>
                                                    <div className={cn("font-semibold", event.points_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                                        {event.points_delta > 0 ? "+" : ""}{event.points_delta} pts
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-muted-foreground">{formatDateTime(event.created_at)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Referral network</CardTitle>
                                <CardDescription>Who referred this user, who they referred, and what they earned.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Referred by</div>
                                    <div className="mt-2 font-semibold text-foreground">
                                        {referredByProfile?.full_name || referredByProfile?.company_name || "Direct signup"}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {referredByProfile?.phone || profile.referred_by || "No upstream referral"}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground">Referred users</div>
                                    {referredUsers.length === 0 ? (
                                        <EmptyState title="No referred users" description="This account has not referred anyone yet." />
                                    ) : (
                                        referredUsers.slice(0, 8).map((user) => (
                                            <div key={user.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
                                                <div>
                                                    <div className="font-medium text-foreground">{user.full_name || user.company_name || shortId(user.id, 10)}</div>
                                                    <div className="text-sm text-muted-foreground">{user.phone || "No phone on file"}</div>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{formatDateTime(user.updated_at)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground">Recent commission events</div>
                                    {referralCommissions.length === 0 ? (
                                        <EmptyState title="No commissions" description="Referral commission has not been earned on this account yet." />
                                    ) : (
                                        referralCommissions.slice(0, 6).map((commission) => (
                                            <div key={commission.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
                                                <div>
                                                    <div className="font-medium text-foreground">{labelize(commission.source_kind)}</div>
                                                    <div className="text-sm text-muted-foreground">Source {formatKobo(commission.source_amount_kobo)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKobo(commission.commission_amount_kobo)}</div>
                                                    <div className="text-xs text-muted-foreground">{formatDateTime(commission.created_at)}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="support" className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Conversations" value={String(supportConversations.length)} helper="Total support threads tied to this user." />
                        <MetricCard title="Open threads" value={String(openSupportCount)} helper="Still waiting for closure or resolution." />
                        <MetricCard title="Escalated" value={String(escalatedSupportCount)} helper="Human handoff or intervention required." />
                        <MetricCard title="Resolved by AI" value={String(supportConversations.filter((item) => item.resolved_by_ai).length)} helper="Threads closed without human takeover." />
                    </div>

                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <CardTitle>Recent support conversations</CardTitle>
                            <CardDescription>Support load, escalation risk, and the latest customer context.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {supportConversations.length === 0 ? (
                                <EmptyState title="No support history" description="This user has not opened any support conversations yet." />
                            ) : (
                                <div className="space-y-3">
                                    {supportConversations.map((conversation) => (
                                        <div key={conversation.id} className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="font-semibold text-foreground">{conversation.subject || "Support conversation"}</div>
                                                        <Badge variant="outline" className={cn(getGenericStatusTone(conversation.status))}>
                                                            {labelize(conversation.status ?? "open")}
                                                        </Badge>
                                                        {conversation.escalated_to_human ? (
                                                            <Badge variant="outline" className={cn(getGenericStatusTone("pending"))}>
                                                                Human escalation
                                                            </Badge>
                                                        ) : null}
                                                        {conversation.resolved_by_ai ? (
                                                            <Badge variant="outline" className={cn(getGenericStatusTone("approved"))}>
                                                                Resolved by AI
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Channel {labelize(conversation.channel ?? "web")} · Last message {formatDateTime(conversation.last_message_at ?? conversation.updated_at)}
                                                    </div>
                                                    <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                                                        {conversation.last_message_preview || "No message preview recorded."}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Created {formatDateTime(conversation.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {agentProfile ? (
                    <TabsContent value="agent" className="mt-6 space-y-6">
                        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Agent application status</h3>
                                <p className="text-sm text-muted-foreground">
                                    Current state <span className="font-medium text-foreground">{labelize(agentProfile.status ?? "pending")}</span> · Submitted {formatDateTime(agentProfile.created_at)}
                                </p>
                            </div>
                            <AgentApprovalButtons agentId={agentProfile.id} status={agentProfile.status ?? "pending"} />
                        </div>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Bank details</CardTitle>
                                <CardDescription>The payout account linked to the agent workspace.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Bank name</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(agentBankDetails, "bankName") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Account number</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(agentBankDetails, "accountNumber") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4 md:col-span-2">
                                    <div className="text-sm text-muted-foreground">Account name</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(agentBankDetails, "accountName") || "Not provided"}</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Identity and guarantors</CardTitle>
                                <CardDescription>Documents and references submitted for the agent application.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 xl:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground">Identity document</div>
                                    {agentProfile.id_card_url ? (
                                        <div className="space-y-3">
                                            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={agentProfile.id_card_url} alt="Agent ID card" fill className="object-contain" />
                                            </div>
                                            <Button asChild variant="outline">
                                                <Link href={agentProfile.id_card_url} target="_blank" rel="noopener noreferrer">
                                                    Open original
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <EmptyState title="No ID card uploaded" description="The agent has not submitted an identity document yet." />
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground">Guarantors</div>
                                    {(["guarantor1", "guarantor2"] as const).map((key) => {
                                        const guarantor = asRecord(agentGuarantors?.[key])

                                        return (
                                            <div key={key} className="rounded-2xl border border-border/60 p-4">
                                                <div className="font-medium text-foreground">{key === "guarantor1" ? "Guarantor 1" : "Guarantor 2"}</div>
                                                <div className="mt-3 space-y-2 text-sm">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Name</span>
                                                        <span className="font-medium text-foreground">{getRecordText(guarantor, "name") || "Not provided"}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Phone</span>
                                                        <span className="font-medium text-foreground">{getRecordText(guarantor, "phone") || "Not provided"}</span>
                                                    </div>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <span className="text-muted-foreground">Address</span>
                                                        <span className="text-right font-medium text-foreground">{getRecordText(guarantor, "address") || "Not provided"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ) : null}

                {riderProfile ? (
                    <TabsContent value="rider" className="mt-6 space-y-6">
                        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Rider application status</h3>
                                <p className="text-sm text-muted-foreground">
                                    Current state <span className="font-medium text-foreground">{labelize(riderProfile.status ?? "pending")}</span> · Submitted {formatDateTime(riderProfile.created_at)}
                                </p>
                            </div>
                            <RiderApprovalButtons riderId={riderProfile.id} status={riderProfile.status ?? "pending"} />
                        </div>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Bike documents</CardTitle>
                                <CardDescription>Operational documents attached to the rider setup.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-3">
                                {([
                                    { key: "license_url", label: "Bike license" },
                                    { key: "insurance_url", label: "Insurance" },
                                    { key: "roadworthiness_url", label: "Road worthiness" },
                                ] as const).map((item) => {
                                    const url = getRecordText(riderBikeParticulars, item.key)

                                    if (!url) {
                                        return (
                                            <EmptyState key={item.key} title={`No ${item.label.toLowerCase()}`} description={`The rider has not uploaded ${item.label.toLowerCase()} yet.`} />
                                        )
                                    }

                                    return (
                                        <div key={item.key} className="space-y-3">
                                            <div className="text-sm font-semibold text-foreground">{item.label}</div>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={url} alt={item.label} fill className="object-contain" />
                                            </div>
                                            <Button asChild variant="outline" className="w-full">
                                                <Link href={url} target="_blank" rel="noopener noreferrer">
                                                    Open original
                                                </Link>
                                            </Button>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Identity and guarantor</CardTitle>
                                <CardDescription>The rider identity documents and guarantor records on file.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 xl:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="text-sm font-semibold text-foreground">Rider identity</div>
                                    {riderProfile.id_card_url ? (
                                        <div className="space-y-3">
                                            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={riderProfile.id_card_url} alt="Rider ID card" fill className="object-contain" />
                                            </div>
                                            <Button asChild variant="outline">
                                                <Link href={riderProfile.id_card_url} target="_blank" rel="noopener noreferrer">
                                                    Open ID card
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <EmptyState title="No rider ID card" description="The rider has not uploaded an ID card yet." />
                                    )}

                                    {riderProfile.passport_photo_url ? (
                                        <div className="space-y-3">
                                            <div className="text-sm font-semibold text-foreground">Passport photo</div>
                                            <div className="relative aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={riderProfile.passport_photo_url} alt="Rider passport photo" fill className="object-cover" />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-border/60 p-4">
                                        <div className="text-sm font-semibold text-foreground">Guarantor details</div>
                                        <div className="mt-3 space-y-2 text-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Name</span>
                                                <span className="font-medium text-foreground">{getRecordText(riderGuarantors, "name") || "Not provided"}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Phone</span>
                                                <span className="font-medium text-foreground">{getRecordText(riderGuarantors, "phone") || "Not provided"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {getRecordText(riderGuarantors, "id_url") ? (
                                        <div className="space-y-3">
                                            <div className="text-sm font-semibold text-foreground">Guarantor ID</div>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={getRecordText(riderGuarantors, "id_url")!} alt="Guarantor ID" fill className="object-contain" />
                                            </div>
                                        </div>
                                    ) : null}

                                    {getRecordText(riderGuarantors, "form_url") ? (
                                        <div className="space-y-3">
                                            <div className="text-sm font-semibold text-foreground">Guarantor form</div>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                                <Image src={getRecordText(riderGuarantors, "form_url")!} alt="Guarantor form" fill className="object-contain" />
                                            </div>
                                        </div>
                                    ) : (
                                        <EmptyState title="No guarantor form" description="The rider has not uploaded a guarantor form yet." />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ) : null}

                {merchantProfile ? (
                    <TabsContent value="merchant" className="mt-6 space-y-6">
                        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Merchant workspace</h3>
                                <p className="text-sm text-muted-foreground">
                                    Status <span className="font-medium text-foreground">{labelize(merchantProfile.status ?? "pending")}</span> · Submitted {formatDateTime(merchantProfile.created_at)}
                                </p>
                            </div>
                            <Button asChild variant="outline">
                                <Link href="/dashboard/approvals">Open approvals queue</Link>
                            </Button>
                        </div>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>Merchant details</CardTitle>
                                <CardDescription>Store identity and the business profile captured from the application.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Store name</div>
                                    <div className="mt-2 font-medium text-foreground">{merchantProfile.store_name || profile.company_name || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Merchant type</div>
                                    <div className="mt-2 font-medium text-foreground">{labelize(merchantProfile.merchant_type ?? "unknown")}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Category</div>
                                    <div className="mt-2 font-medium text-foreground">{merchantProfile.category || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Status</div>
                                    <div className="mt-2">
                                        <Badge variant="outline" className={cn(getGenericStatusTone(merchantProfile.status))}>
                                            {labelize(merchantProfile.status ?? "unknown")}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4 md:col-span-2">
                                    <div className="text-sm text-muted-foreground">Business address</div>
                                    <div className="mt-2 font-medium text-foreground">{merchantProfile.business_address || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4 md:col-span-2">
                                    <div className="text-sm text-muted-foreground">Store description</div>
                                    <div className="mt-2 font-medium text-foreground">{merchantProfile.store_description || "Not provided"}</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>KYC details</CardTitle>
                                <CardDescription>Structured merchant information captured at signup.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">RC number</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(merchantKyc, "rc_number") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">TIN</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(merchantKyc, "tin") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Incorporation date</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(merchantKyc, "incorporation_date") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4">
                                    <div className="text-sm text-muted-foreground">Next of kin</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(merchantKyc, "next_of_kin_name") || "Not provided"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 p-4 md:col-span-2">
                                    <div className="text-sm text-muted-foreground">Next of kin phone</div>
                                    <div className="mt-2 font-medium text-foreground">{getRecordText(merchantKyc, "next_of_kin_phone") || "Not provided"}</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>KYC documents</CardTitle>
                                <CardDescription>Uploaded merchant compliance files currently stored in Cloudinary.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {merchantDocuments.length === 0 ? (
                                    <EmptyState title="No merchant documents" description="The merchant application has no Cloudinary KYC document URLs saved yet." />
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {merchantDocuments.map((document) => (
                                            <div key={document.key} className="rounded-2xl border border-border/60 p-4">
                                                <div className="font-medium text-foreground">{document.label}</div>
                                                <div className="mt-1 text-sm text-muted-foreground">Cloudinary asset linked from merchant KYC data.</div>
                                                <Button asChild variant="outline" className="mt-4 w-full">
                                                    <Link href={document.url} target="_blank" rel="noopener noreferrer">
                                                        Open document
                                                    </Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ) : null}
            </Tabs>
        </div>
    )
}
