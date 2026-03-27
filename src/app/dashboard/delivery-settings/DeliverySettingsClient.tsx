"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Bike, Compass, Loader2, MapPinned, Route, Wallet } from "lucide-react"
import { updateDeliverySettings } from "@/actions/platform"
import { formatKobo, nairaToKobo } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface DeliverySettingsFormValues {
    baseFareNaira: number
    distanceRateNairaPerKm: number
    riderSharePercent: number
    corporateDeliverySharePercent: number
    originLat: number
    originLng: number
    originState: string
}

interface DeliverySettingsClientProps {
    initialSettings: DeliverySettingsFormValues
}

function buildFormData(settings: DeliverySettingsFormValues) {
    const formData = new FormData()

    formData.set("base_fare_naira", String(settings.baseFareNaira))
    formData.set("distance_rate_naira_per_km", String(settings.distanceRateNairaPerKm))
    formData.set("rider_share_percent", String(settings.riderSharePercent))
    formData.set("corporate_delivery_share_percent", String(settings.corporateDeliverySharePercent))
    formData.set("origin_lat", String(settings.originLat))
    formData.set("origin_lng", String(settings.originLng))
    formData.set("origin_state", settings.originState)

    return formData
}

export function DeliverySettingsClient({ initialSettings }: DeliverySettingsClientProps) {
    const router = useRouter()
    const [settings, setSettings] = useState(initialSettings)
    const [sampleDistanceKm, setSampleDistanceKm] = useState(12)
    const [isPending, startTransition] = useTransition()

    const shareTotalBps =
        Math.round(settings.riderSharePercent * 100)
        + Math.round(settings.corporateDeliverySharePercent * 100)
    const sampleFeeKobo = nairaToKobo(
        Math.max(0, settings.baseFareNaira) + Math.max(0, sampleDistanceKm) * Math.max(0, settings.distanceRateNairaPerKm)
    )
    const sampleRiderPayoutKobo = Math.round(sampleFeeKobo * (Math.max(0, settings.riderSharePercent) / 100))
    const sampleCorporateShareKobo = Math.max(0, sampleFeeKobo - sampleRiderPayoutKobo)

    function handleSave() {
        if (shareTotalBps !== 10_000) {
            toast.error("Rider and corporate shares must add up to 100%.")
            return
        }

        startTransition(async () => {
            try {
                const result = await updateDeliverySettings(buildFormData(settings))

                if (result?.error) {
                    toast.error(result.error)
                    return
                }

                toast.success("Delivery settings updated.")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update delivery settings.")
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#F58220]">Operations control</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Delivery settings</h1>
                    <p className="mt-3 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
                        Manage the exact fee formula used at checkout and the split that posts to rider earnings when delivery is verified.
                    </p>
                </div>

                <Button asChild variant="outline" className="rounded-full">
                    <Link href="/dashboard/settings">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to settings
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                        <Wallet className="h-4 w-4" />
                        <span>Base fare</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold">{formatKobo(nairaToKobo(settings.baseFareNaira))}</p>
                    <p className="mt-2 text-sm text-white/80">Charged before any distance component is added.</p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Route className="h-4 w-4" />
                        <span>Distance rate</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                        {formatKobo(nairaToKobo(settings.distanceRateNairaPerKm))}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Applied per kilometer from the configured origin point.</p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Bike className="h-4 w-4" />
                        <span>Rider payout split</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{settings.riderSharePercent.toFixed(2)}%</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        Corporate share {settings.corporateDeliverySharePercent.toFixed(2)}%.
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <MapPinned className="h-4 w-4" />
                        <span>Origin point</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{settings.originState || "Origin required"}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        {settings.originLat.toFixed(4)}, {settings.originLng.toFixed(4)}
                    </p>
                </div>
            </div>

            <section className="rounded-3xl border border-orange-100 bg-orange-50/70 p-6 shadow-sm dark:border-orange-900/30 dark:bg-orange-950/10">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#F58220]">
                            <Compass className="h-4 w-4" />
                            <span>Formula preview</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                            Customer fee = base fare + (distance x rate per km)
                        </p>
                        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-zinc-300">
                            Current storefront logic measures from this fixed origin to the customer&apos;s saved location. It does not use the merchant-to-customer route yet.
                        </p>
                    </div>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Preview distance (km)</span>
                        <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={sampleDistanceKm}
                            onChange={(event) => setSampleDistanceKm(Number(event.target.value) || 0)}
                            className="h-12 w-full rounded-xl bg-white dark:bg-zinc-900 lg:w-40"
                        />
                    </label>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Customer fee</p>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(sampleFeeKobo)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Rider payout</p>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(sampleRiderPayoutKobo)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Corporate delivery share</p>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(sampleCorporateShareKobo)}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit delivery configuration</h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Changes here apply immediately to new checkout calculations and the rider share used during order settlement.
                    </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Base fare (NGN)</span>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.baseFareNaira}
                            onChange={(event) => setSettings((current) => ({ ...current, baseFareNaira: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Distance rate per km (NGN)</span>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.distanceRateNairaPerKm}
                            onChange={(event) => setSettings((current) => ({ ...current, distanceRateNairaPerKm: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Origin state</span>
                        <Input
                            value={settings.originState}
                            onChange={(event) => setSettings((current) => ({ ...current, originState: event.target.value }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Origin latitude</span>
                        <Input
                            type="number"
                            step="0.000001"
                            value={settings.originLat}
                            onChange={(event) => setSettings((current) => ({ ...current, originLat: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Origin longitude</span>
                        <Input
                            type="number"
                            step="0.000001"
                            value={settings.originLng}
                            onChange={(event) => setSettings((current) => ({ ...current, originLng: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Split guardrail</p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                            Rider and corporate shares must total exactly 100%.
                        </p>
                        <p className={`mt-4 text-2xl font-bold ${shareTotalBps === 10_000 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
                            {(shareTotalBps / 100).toFixed(2)}%
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Rider share (%)</span>
                        <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.riderSharePercent}
                            onChange={(event) => setSettings((current) => ({ ...current, riderSharePercent: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Corporate share (%)</span>
                        <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.corporateDeliverySharePercent}
                            onChange={(event) => setSettings((current) => ({ ...current, corporateDeliverySharePercent: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        className="rounded-full bg-[#F58220] px-6 text-white hover:bg-[#F58220]/90"
                        onClick={handleSave}
                        disabled={isPending}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save delivery settings
                    </Button>
                </div>
            </section>
        </div>
    )
}
