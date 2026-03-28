"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Loader2, Save, Wallet } from "lucide-react"
import { toast } from "sonner"
import { updateWalletWithdrawalSettings } from "@/actions/platform"
import { Button } from "@/components/ui/button"
import {
    type WalletWithdrawalSettings,
    type RoleWalletWithdrawalMode,
} from "@/lib/wallet-withdrawal-settings"

interface WalletWithdrawalSettingsClientProps {
    initialSettings: WalletWithdrawalSettings
}

function buildFormData(mode: RoleWalletWithdrawalMode) {
    const formData = new FormData()
    formData.set("role_wallet_withdrawal_mode", mode)
    return formData
}

export function WalletWithdrawalSettingsClient({
    initialSettings,
}: WalletWithdrawalSettingsClientProps) {
    const router = useRouter()
    const [roleWalletWithdrawalMode, setRoleWalletWithdrawalMode] = useState<RoleWalletWithdrawalMode>(
        initialSettings.roleWalletWithdrawalMode
    )
    const [isPending, startTransition] = useTransition()

    const preview = useMemo(() => {
        if (roleWalletWithdrawalMode === "anytime") {
            return {
                title: "Operational wallets can withdraw anytime",
                description:
                    "Merchant, agent, and rider wallets remain withdraw-only, but users can cash out as soon as settlement posts.",
            }
        }

        return {
            title: "Operational wallets are month-end only",
            description:
                "Merchant, agent, and rider wallets remain withdraw-only and can only cash out on the last day of the month in Africa/Lagos.",
        }
    }, [roleWalletWithdrawalMode])

    function handleSave() {
        startTransition(async () => {
            try {
                const result = await updateWalletWithdrawalSettings(
                    buildFormData(roleWalletWithdrawalMode)
                )

                if (result?.error) {
                    toast.error(result.error)
                    return
                }

                toast.success("Wallet withdrawal settings updated.")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update wallet withdrawal settings.")
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#F58220]">Wallet control</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Wallet withdrawals</h1>
                    <p className="mt-3 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
                        Customer wallets always support top-up and withdrawal. This page controls only the operational
                        merchant, agent, and rider wallet withdrawal window.
                    </p>
                </div>

                <Button asChild variant="outline" className="rounded-full">
                    <Link href="/dashboard/settings">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to settings
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                        <Wallet className="h-4 w-4" />
                        <span>Customer wallet</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold">Always open</p>
                    <p className="mt-2 text-sm text-white/80">
                        Top up and withdraw remain available at any time.
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Wallet className="h-4 w-4" />
                        <span>Operational wallets</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
                        {roleWalletWithdrawalMode === "anytime" ? "Withdraw anytime" : "Month-end only"}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        Applies to merchant, agent, and rider wallet payouts.
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <CalendarDays className="h-4 w-4" />
                        <span>Month-end rule</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Africa/Lagos</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        Server-side enforcement uses the last calendar day in Lagos time.
                    </p>
                </div>
            </div>

            <section className="rounded-3xl border border-orange-100 bg-orange-50/70 p-6 shadow-sm dark:border-orange-900/30 dark:bg-orange-950/10">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">Live effect</p>
                <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{preview.title}</h2>
                <p className="mt-3 max-w-3xl text-sm text-gray-600 dark:text-zinc-300">{preview.description}</p>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Choose operational withdrawal mode</h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Customer wallets are unaffected here. This only changes how operational role wallets can withdraw.
                    </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setRoleWalletWithdrawalMode("anytime")}
                        className={`rounded-3xl border p-5 text-left transition ${
                            roleWalletWithdrawalMode === "anytime"
                                ? "border-[#F58220] bg-orange-50 shadow-sm dark:border-orange-600 dark:bg-orange-950/20"
                                : "border-gray-100 bg-white hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-950"
                        }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">Anytime</p>
                        <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Withdraw immediately after settlement</h3>
                        <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
                            Merchant, agent, and rider wallets stay withdraw-only, but they do not wait for month-end.
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setRoleWalletWithdrawalMode("month_end_only")}
                        className={`rounded-3xl border p-5 text-left transition ${
                            roleWalletWithdrawalMode === "month_end_only"
                                ? "border-[#F58220] bg-orange-50 shadow-sm dark:border-orange-600 dark:bg-orange-950/20"
                                : "border-gray-100 bg-white hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-950"
                        }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">Month-end only</p>
                        <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Restrict to the last day of the month</h3>
                        <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
                            Merchant, agent, and rider wallets stay withdraw-only and can cash out only during the Lagos month-end window.
                        </p>
                    </button>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        className="rounded-full bg-orange-500 px-6 hover:bg-orange-600"
                        onClick={handleSave}
                        disabled={isPending}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save wallet rule
                    </Button>
                </div>
            </section>
        </div>
    )
}
