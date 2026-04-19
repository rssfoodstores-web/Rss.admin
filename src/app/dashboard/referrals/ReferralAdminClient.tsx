"use client"

import { useState, useTransition } from "react"
import { BarChart3, Loader2, Percent, Save, Trophy, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import type {
    ReferralAdminDashboard,
    ReferralRewardActivity,
} from "./actions"
import { updateReferralCommissionRate } from "./actions"

function formatKobo(amountKobo: number) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
    }).format(amountKobo / 100)
}

function formatSourceKind(sourceKind: string) {
    switch (sourceKind) {
        case "merchant_payout":
            return "Merchant payout"
        case "agent_commission":
            return "Agent commission"
        case "rider_earnings":
            return "Rider earnings"
        default:
            return "Referral reward"
    }
}

function formatStamp(value: string) {
    return new Date(value).toLocaleString([], {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    })
}

function RecentRewardRow({ reward }: { reward: ReferralRewardActivity }) {
    return (
        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 last:border-b-0 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                    {reward.referrerName} earned from {reward.referredUserName}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formatSourceKind(reward.sourceKind)} of {formatKobo(reward.sourceAmountKobo)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                    {reward.createdAt ? formatStamp(reward.createdAt) : "-"}
                </p>
            </div>
            <p className="text-left text-base font-bold text-emerald-600 sm:text-right">
                {formatKobo(reward.commissionAmountKobo)}
            </p>
        </div>
    )
}

export function ReferralAdminClient({ initialData }: { initialData: ReferralAdminDashboard }) {
    const [ratePercent, setRatePercent] = useState((initialData.commissionBps / 100).toFixed(2))
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        const numericRate = Number.parseFloat(ratePercent)

        startTransition(() => {
            void (async () => {
                try {
                    await updateReferralCommissionRate(numericRate)
                    toast.success("Referral commission updated.")
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to update referral commission.")
                }
            })()
        })
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.72fr_1.28fr]">
                <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Commission control</p>
                            <h2 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">Referral percentage</h2>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Updates here apply to future referral reward credits immediately.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                            <Percent className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={ratePercent}
                                onChange={(event) => setRatePercent(event.target.value)}
                                className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-14 text-lg font-bold text-gray-900 outline-none transition focus:border-[#F58220] focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold uppercase tracking-[0.18em] text-gray-400">
                                %
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending}
                            className="inline-flex h-14 items-center justify-center rounded-2xl bg-[#F58220] px-6 text-sm font-bold text-white transition hover:bg-[#E57210] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save rate
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#F58220] dark:bg-orange-950/20">
                            <Users className="h-5 w-5" />
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Total referrals</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{initialData.stats.totalReferrals}</p>
                    </div>

                    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/20">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Active referrers</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{initialData.stats.activeReferrers}</p>
                    </div>

                    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Rewards paid</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{formatKobo(initialData.stats.totalRewardsKobo)}</p>
                    </div>

                    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/20">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Reward events</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{initialData.stats.rewardEvents}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Performance ranking</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Top referrers ranked by earned referral rewards and referral volume.
                        </p>
                    </div>

                    {initialData.leaderboard.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                            Ranking data will appear once referrals begin earning.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {initialData.leaderboard.map((item) => (
                                <div key={item.referrerId} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-sm font-extrabold text-gray-700 dark:bg-zinc-800 dark:text-white">
                                            #{item.rank}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{item.fullName}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">
                                                {item.referralCode} | {item.totalReferrals} referrals | {item.rewardEvents} rewards
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-left text-base font-bold text-[#F58220] sm:text-right">
                                        {formatKobo(item.totalEarningsKobo)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent reward activity</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Latest referral rewards credited across the platform.
                        </p>
                    </div>

                    {initialData.recentRewards.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                            No referral rewards have been generated yet.
                        </div>
                    ) : (
                        <div>
                            {initialData.recentRewards.map((reward) => (
                                <RecentRewardRow key={reward.id} reward={reward} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
