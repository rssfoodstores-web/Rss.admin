import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { updateAssignmentSettings, updateDeliverySettings, updatePlatformFinancialSettings } from "@/actions/platform"
import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { formatPercentFromBps } from "@/lib/admin-display"
import { koboToNaira } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default async function SettingsPage() {
    await requireAdminRoleAccess(["supa_admin"], "settings")
    const supabase = await createClient()
    async function updateDeliverySettingsForm(formData: FormData) {
        "use server"
        await updateDeliverySettings(formData)
    }

    async function updatePlatformFinancialSettingsForm(formData: FormData) {
        "use server"
        await updatePlatformFinancialSettings(formData)
    }

    async function updateAssignmentSettingsForm(formData: FormData) {
        "use server"
        await updateAssignmentSettings(formData)
    }

    const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["delivery_settings", "platform_financial_settings", "assignment_settings"])

    const settings = (data ?? []) as Array<{ key: string, value: Record<string, number | string> }>
    const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]))

    const delivery = settingsMap.get("delivery_settings") ?? {}
    const financial = settingsMap.get("platform_financial_settings") ?? {}
    const assignment = settingsMap.get("assignment_settings") ?? {}

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Configure delivery, pricing, and assignment rules in kobo and basis points.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Delivery Split</CardTitle>
                        <CardDescription>Current rider vs corporate allocation.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        Rider {formatPercentFromBps(Number(delivery.rider_share_bps ?? 8000))} • Corporate {formatPercentFromBps(Number(delivery.corporate_delivery_share_bps ?? 2000))}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Platform Formula</CardTitle>
                        <CardDescription>Merchant-derived fee stack.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        Agent {formatPercentFromBps(Number(financial.agent_fee_bps ?? 200))} • App {formatPercentFromBps(Number(financial.app_fee_bps ?? 1000))} • Ops {formatPercentFromBps(Number(financial.ops_fee_bps ?? 200))}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Assignment Radius</CardTitle>
                        <CardDescription>Current rider discovery radius.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {Number(assignment.rider_radius_meters ?? 5000).toLocaleString()} meters
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link href="/dashboard/referrals" className="rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm font-semibold text-[#F58220] transition hover:bg-orange-100 dark:border-orange-950 dark:bg-orange-950/20 dark:text-orange-300">
                    Referral management
                </Link>
                <Link href="/dashboard/rewards" className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    Reward points management
                </Link>
                <Link href="/dashboard/cook-off" className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300">
                    Cook-Off management
                </Link>
                <Link href="/dashboard/discount-bundles" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                    Discount bundle management
                </Link>
                <Link href="/dashboard/contact" className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                    Contact page management
                </Link>
                <Link href="/dashboard/faqs" className="rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                    FAQ page management
                </Link>
                <Link href="/dashboard/terms" className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
                    Terms page management
                </Link>
                <Link href="/dashboard/privacy" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                    Privacy page management
                </Link>
                <Link href="/dashboard/support" className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                    Support chat management
                </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Delivery Settings</CardTitle>
                        <CardDescription>Base fare, distance rate, origin point, and delivery revenue split.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={updateDeliverySettingsForm} className="grid gap-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Base Fare (NGN)</label>
                                    <Input type="number" step="0.01" min="0" name="base_fare_naira" defaultValue={koboToNaira(Number(delivery.base_fare_kobo ?? 100000))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Distance Rate / KM (NGN)</label>
                                    <Input type="number" step="0.01" min="0" name="distance_rate_naira_per_km" defaultValue={koboToNaira(Number(delivery.distance_rate_kobo_per_km ?? 10000))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Rider Share (%)</label>
                                    <Input type="number" step="0.01" min="0" max="100" name="rider_share_percent" defaultValue={Number(delivery.rider_share_bps ?? 8000) / 100} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Corporate Share (%)</label>
                                    <Input type="number" step="0.01" min="0" max="100" name="corporate_delivery_share_percent" defaultValue={Number(delivery.corporate_delivery_share_bps ?? 2000) / 100} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Origin Latitude</label>
                                    <Input type="number" step="0.000001" name="origin_lat" defaultValue={Number(delivery.origin_lat ?? 6.5244)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Origin Longitude</label>
                                    <Input type="number" step="0.000001" name="origin_lng" defaultValue={Number(delivery.origin_lng ?? 3.3792)} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Origin State</label>
                                <Input name="origin_state" defaultValue={String(delivery.origin_state ?? "Lagos")} />
                            </div>
                            <Button type="submit" className="w-fit bg-orange-500 hover:bg-orange-600">
                                Save Delivery Settings
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Platform Financial Settings</CardTitle>
                        <CardDescription>Admin-controlled margin, VAT, and insurance defaults.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={updatePlatformFinancialSettingsForm} className="grid gap-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Agent Fee (%)</label>
                                    <Input type="number" step="0.01" min="0" name="agent_fee_percent" defaultValue={Number(financial.agent_fee_bps ?? 200) / 100} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">App Fee (%)</label>
                                    <Input type="number" step="0.01" min="0" name="app_fee_percent" defaultValue={Number(financial.app_fee_bps ?? 1000) / 100} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Ops Fee (%)</label>
                                    <Input type="number" step="0.01" min="0" name="ops_fee_percent" defaultValue={Number(financial.ops_fee_bps ?? 200) / 100} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">VAT (%)</label>
                                    <Input type="number" step="0.01" min="0" name="vat_percent" defaultValue={Number(financial.vat_bps ?? 750) / 100} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Default Insurance (NGN)</label>
                                <Input type="number" step="0.01" min="0" name="insurance_default_naira" defaultValue={koboToNaira(Number(financial.insurance_default_kobo ?? 0))} />
                            </div>
                            <Button type="submit" className="w-fit bg-orange-500 hover:bg-orange-600">
                                Save Financial Settings
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Assignment Settings</CardTitle>
                    <CardDescription>Configure rider discovery radius and assignment strategy.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={updateAssignmentSettingsForm} className="grid gap-4 md:grid-cols-[220px_220px_auto] md:items-end">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Rider Radius (Meters)</label>
                            <Input type="number" step="1" min="100" name="rider_radius_meters" defaultValue={Number(assignment.rider_radius_meters ?? 5000)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Auto Assignment Strategy</label>
                            <select
                                name="auto_assignment_strategy"
                                defaultValue={String(assignment.auto_assignment_strategy ?? "balanced_auto")}
                                className="h-10 rounded-md border bg-background px-3 text-sm"
                            >
                                <option value="balanced_auto">Balanced Auto</option>
                                <option value="nearest_first">Nearest First</option>
                                <option value="manual_preferred">Manual Preferred</option>
                            </select>
                        </div>
                        <Button type="submit" className="w-fit bg-orange-500 hover:bg-orange-600">
                            Save Assignment Settings
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
