"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Coins, Power, TimerReset, TrendingDown, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatKobo } from "@/lib/money"
import type { RewardAdminDashboard, RewardAdminSettings } from "./actions"
import { updateRewardSettings } from "./actions"

interface RewardAdminClientProps {
    initialData: RewardAdminDashboard
}

function getEventLabel(eventType: string) {
    switch (eventType) {
        case "earned_available":
            return "Issued"
        case "earned_pending":
            return "Pending"
        case "redeemed":
            return "Redeemed"
        case "restored":
            return "Restored"
        case "expired":
            return "Expired"
        case "reversed":
            return "Reversed"
        default:
            return "Activity"
    }
}

function getEventTone(pointsDelta: number) {
    if (pointsDelta > 0) {
        return "text-emerald-700 dark:text-emerald-300"
    }

    if (pointsDelta < 0) {
        return "text-red-600 dark:text-red-300"
    }

    return "text-gray-500 dark:text-gray-400"
}

export function RewardAdminClient({ initialData }: RewardAdminClientProps) {
    const router = useRouter()
    const [settings, setSettings] = useState<RewardAdminSettings>(initialData.settings)
    const [isPending, startTransition] = useTransition()

    const handleSubmit = () => {
        startTransition(async () => {
            try {
                await updateRewardSettings(settings)
                toast.success("Reward settings updated.")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update reward settings.")
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                        <Power className="h-4 w-4" />
                        <span>System status</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold">{settings.enabled ? "Enabled" : "Paused"}</p>
                    <p className="mt-2 text-sm text-white/80">Admins can stop redemptions and future accruals here at any time.</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <TrendingUp className="h-4 w-4" />
                        <span>Points issued</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.pointsIssued.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <TrendingDown className="h-4 w-4" />
                        <span>Points redeemed</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.pointsRedeemed.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <TimerReset className="h-4 w-4" />
                        <span>Points expired</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.pointsExpired.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Coins className="h-4 w-4" />
                        <span>Outstanding available</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.outstandingAvailablePoints.toLocaleString()}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Approx. checkout value {formatKobo(initialData.stats.outstandingAvailablePoints * settings.pointValueNaira * 100)}.
                    </p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Users className="h-4 w-4" />
                        <span>Accounts with balance</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.activeBalances.toLocaleString()}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Pending across accounts: {initialData.stats.outstandingPendingPoints.toLocaleString()} points.
                    </p>
                </div>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reward settings</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Changes here apply immediately to new redemptions and new reward accrual events.
                    </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">System status</span>
                        <select
                            value={settings.enabled ? "enabled" : "disabled"}
                            onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.value === "enabled" }))}
                            className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/50"
                        >
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Point value (NGN)</span>
                        <Input
                            type="number"
                            min="1"
                            step="1"
                            value={settings.pointValueNaira}
                            onChange={(event) => setSettings((current) => ({ ...current, pointValueNaira: Number(event.target.value) || 1 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Points per spend unit</span>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.purchasePointsPerSpendUnit}
                            onChange={(event) => setSettings((current) => ({ ...current, purchasePointsPerSpendUnit: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Spend unit (NGN)</span>
                        <Input
                            type="number"
                            min="1"
                            step="1"
                            value={settings.purchaseSpendUnitNaira}
                            onChange={(event) => setSettings((current) => ({ ...current, purchaseSpendUnitNaira: Number(event.target.value) || 1 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Expiry (days)</span>
                        <Input
                            type="number"
                            min="1"
                            step="1"
                            value={settings.expirationDays}
                            onChange={(event) => setSettings((current) => ({ ...current, expirationDays: Number(event.target.value) || 1 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Referral welcome bonus</span>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.referralWelcomeBonusPoints}
                            onChange={(event) => setSettings((current) => ({ ...current, referralWelcomeBonusPoints: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cook-Off approved bonus</span>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.cookOffApprovedPoints}
                            onChange={(event) => setSettings((current) => ({ ...current, cookOffApprovedPoints: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cook-Off featured bonus</span>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.cookOffFeaturedBonusPoints}
                            onChange={(event) => setSettings((current) => ({ ...current, cookOffFeaturedBonusPoints: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cook-Off winner bonus</span>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.cookOffWinnerBonusPoints}
                            onChange={(event) => setSettings((current) => ({ ...current, cookOffWinnerBonusPoints: Number(event.target.value) || 0 }))}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50"
                        />
                    </label>
                </div>

                <div className="mt-6">
                    <Button
                        type="button"
                        className="rounded-full bg-[#F58220] text-white hover:bg-[#F58220]/90"
                        onClick={handleSubmit}
                        disabled={isPending}
                    >
                        {isPending ? "Saving..." : "Save reward settings"}
                    </Button>
                </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent reward activity</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Latest issuance, redemption, expiry, and reversal events across all users.
                    </p>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {initialData.activity.length === 0 ? (
                        <div className="px-6 py-12 text-sm text-gray-500 dark:text-gray-400">
                            No reward activity has been generated yet.
                        </div>
                    ) : (
                        initialData.activity.map((item) => (
                            <div key={item.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900 dark:text-white">{item.userName}</p>
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                                            {getEventLabel(item.eventType)}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                                    <p className="mt-1 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                                </div>
                                <p className={`text-lg font-bold ${getEventTone(item.pointsDelta)}`}>
                                    {item.pointsDelta > 0 ? "+" : ""}
                                    {item.pointsDelta.toLocaleString()} pts
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}
