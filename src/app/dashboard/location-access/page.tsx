import { createClient } from "@/lib/supabase/server"
import {
    approveMerchantLocationRequest,
    denyMerchantLocationRequest,
    updateMerchantLocationPolicy,
} from "@/actions/platform"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface MerchantLocationPolicy {
    request_cooldown_enabled: boolean
    request_cooldown_hours: number
}

interface MerchantProfileRow {
    id: string
    full_name: string | null
    phone: string | null
    address: string | null
    update_requested: boolean | null
    location_locked: boolean | null
    location_update_requested_at: string | null
    location_last_verified_at: string | null
}

interface MerchantRow {
    id: string
    store_name: string | null
    business_address: string | null
    status: string | null
}

const DEFAULT_POLICY: MerchantLocationPolicy = {
    request_cooldown_enabled: true,
    request_cooldown_hours: 168,
}

function normalizePolicy(value: unknown): MerchantLocationPolicy {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return DEFAULT_POLICY
    }

    const record = value as Record<string, unknown>
    const requestCooldownHours = Number(record.request_cooldown_hours)

    return {
        request_cooldown_enabled: typeof record.request_cooldown_enabled === "boolean"
            ? record.request_cooldown_enabled
            : DEFAULT_POLICY.request_cooldown_enabled,
        request_cooldown_hours: Number.isFinite(requestCooldownHours) && requestCooldownHours >= 0
            ? requestCooldownHours
            : DEFAULT_POLICY.request_cooldown_hours,
    }
}

function formatDateTime(value: string | null) {
    if (!value) {
        return "Not available"
    }

    return new Date(value).toLocaleString()
}

export default async function LocationAccessPage() {
    await requireAdminRouteAccess("location_access")
    const supabase = await createClient()

    async function updatePolicyAction(formData: FormData) {
        "use server"
        await updateMerchantLocationPolicy(formData)
    }

    async function approveRequestAction(formData: FormData) {
        "use server"
        await approveMerchantLocationRequest(formData)
    }

    async function denyRequestAction(formData: FormData) {
        "use server"
        await denyMerchantLocationRequest(formData)
    }

    const [{ data: policyRow }, { data: pendingRows }, { data: unlockedRows }] = await Promise.all([
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", "merchant_location_policy")
            .maybeSingle(),
        supabase
            .from("profiles")
            .select("id, full_name, phone, address, update_requested, location_locked, location_update_requested_at, location_last_verified_at")
            .eq("update_requested", true)
            .order("location_update_requested_at", { ascending: false }),
        supabase
            .from("profiles")
            .select("id, full_name, phone, address, update_requested, location_locked, location_update_requested_at, location_last_verified_at")
            .eq("location_locked", false)
            .eq("update_requested", false)
            .order("location_last_verified_at", { ascending: false, nullsFirst: false }),
    ])

    const pendingProfiles = (pendingRows ?? []) as MerchantProfileRow[]
    const unlockedProfiles = (unlockedRows ?? []) as MerchantProfileRow[]
    const merchantIds = Array.from(new Set([...pendingProfiles, ...unlockedProfiles].map((profile) => profile.id)))

    const { data: merchantRows } = merchantIds.length
        ? await supabase
            .from("merchants")
            .select("id, store_name, business_address, status")
            .in("id", merchantIds)
        : { data: [] as MerchantRow[] }

    const merchantMap = new Map(((merchantRows ?? []) as MerchantRow[]).map((merchant) => [merchant.id, merchant]))
    const policy = normalizePolicy(policyRow?.value)

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Location Access</h1>
                <p className="text-muted-foreground">
                    Control how often merchants can request location edits and approve or deny pending access.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Pending Requests</CardTitle>
                        <CardDescription>Merchants waiting for location edit access.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-3xl font-bold">
                        {pendingProfiles.length}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Unlocked Merchants</CardTitle>
                        <CardDescription>Profiles currently allowed to change location.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-3xl font-bold">
                        {unlockedProfiles.length}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Cooldown Policy</CardTitle>
                        <CardDescription>Current request frequency rule.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {policy.request_cooldown_enabled
                            ? `${policy.request_cooldown_hours} hour cooldown between requests`
                            : "Cooldown disabled. Merchants may request again immediately."}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Merchant Location Policy</CardTitle>
                    <CardDescription>Decide whether merchants must wait before submitting another location edit request.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={updatePolicyAction} className="grid gap-4 md:grid-cols-[auto_220px_auto] md:items-end">
                        <label className="flex items-center gap-3 rounded-lg border p-4 text-sm">
                            <input
                                type="checkbox"
                                name="request_cooldown_enabled"
                                defaultChecked={policy.request_cooldown_enabled}
                                className="h-4 w-4"
                            />
                            Enforce a wait time before merchants can request another location change
                        </label>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Cooldown Hours</label>
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                name="request_cooldown_hours"
                                defaultValue={policy.request_cooldown_hours}
                            />
                        </div>
                        <Button type="submit" className="w-fit bg-orange-500 hover:bg-orange-600">
                            Save Policy
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Merchant Requests</CardTitle>
                    <CardDescription>Approve to unlock the merchant location page, or deny to keep the current verified location locked.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {pendingProfiles.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                            No merchant location requests are pending right now.
                        </div>
                    ) : pendingProfiles.map((profile) => {
                        const merchant = merchantMap.get(profile.id) ?? null

                        return (
                            <div key={profile.id} className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-semibold">
                                            {merchant?.store_name ?? profile.full_name ?? "Merchant"}
                                        </div>
                                        <Badge variant="secondary">
                                            {merchant?.status ?? "merchant"}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {profile.full_name ?? "No profile name"}{profile.phone ? ` • ${profile.phone}` : ""}
                                    </div>
                                    <div className="text-sm">
                                        Current address: {merchant?.business_address ?? profile.address ?? "No saved address"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Requested {formatDateTime(profile.location_update_requested_at)}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <form action={approveRequestAction}>
                                        <input type="hidden" name="merchant_id" value={profile.id} />
                                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 sm:w-auto">
                                            Approve Edit Access
                                        </Button>
                                    </form>
                                    <form action={denyRequestAction}>
                                        <input type="hidden" name="merchant_id" value={profile.id} />
                                        <Button type="submit" variant="outline" className="w-full sm:w-auto">
                                            Deny Request
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Open Edit Access</CardTitle>
                    <CardDescription>Merchants who currently have location editing unlocked.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {unlockedProfiles.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                            No merchants currently have open location edit access.
                        </div>
                    ) : unlockedProfiles.map((profile) => {
                        const merchant = merchantMap.get(profile.id) ?? null

                        return (
                            <div key={profile.id} className="rounded-xl border p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-semibold">
                                        {merchant?.store_name ?? profile.full_name ?? "Merchant"}
                                    </div>
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                        Edit open
                                    </Badge>
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    {profile.full_name ?? "No profile name"}{profile.phone ? ` • ${profile.phone}` : ""}
                                </div>
                                <div className="mt-2 text-sm">
                                    Last verified {formatDateTime(profile.location_last_verified_at)}
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    )
}
