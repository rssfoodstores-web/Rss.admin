"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Loader2, RefreshCw } from "lucide-react"
import { getWhatsAppHealth } from "./actions"
import type { WhatsAppHealthSnapshot } from "@/lib/whatsapp-health"

function HealthCard({ title, value, detail, explanation, tone = "neutral" }: { title: string; value: string; detail: string; explanation: string; tone?: "good" | "warning" | "neutral" }) {
    const [showHelp, setShowHelp] = useState(false)
    const Icon = tone === "good" ? CheckCircle2 : tone === "warning" ? AlertTriangle : HelpCircle
    return <div className="relative rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900" onMouseEnter={() => setShowHelp(true)} onMouseLeave={() => setShowHelp(false)}>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-zinc-300"><Icon className={`h-4 w-4 ${tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-gray-400"}`} />{title}<button type="button" aria-label={`Explain ${title}`} aria-expanded={showHelp} onClick={() => setShowHelp(true)} onBlur={() => setShowHelp(false)} className="rounded-full p-1 text-gray-400 outline-offset-2 hover:text-[#128C7E] focus-visible:outline-2 focus-visible:outline-[#128C7E]"><HelpCircle className="h-4 w-4" /></button></div>
        <p className="mt-3 text-xl font-black text-gray-950 dark:text-white">{value}</p>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-zinc-400">{detail}</p>
        {showHelp ? <div role="tooltip" className="absolute inset-x-3 top-12 z-20 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-950 shadow-lg dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50">{explanation}</div> : null}
    </div>
}

function friendlyLimit(value: string | null) {
    if (!value) return "Not available"
    const labels: Record<string, string> = { TIER_250: "250 unique customers / 24 hours", TIER_2K: "2,000 unique customers / 24 hours", TIER_10K: "10,000 unique customers / 24 hours", TIER_100K: "100,000 unique customers / 24 hours", UNLIMITED: "Unlimited tier" }
    return labels[value.toUpperCase()] ?? value.replaceAll("_", " ")
}

export function AccountHealthWorkspace() {
    const [health, setHealth] = useState<WhatsAppHealthSnapshot | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try { setHealth(await getWhatsAppHealth()) }
        catch { setError("The health check could not run. Please try again or check your WhatsApp Center access.") }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { void refresh() }, [refresh])
    const counts = health?.templates.items.reduce<Record<string, number>>((all, template) => {
        const key = template.status.toUpperCase()
        all[key] = (all[key] ?? 0) + 1
        return all
    }, {}) ?? {}
    const quality = health?.phone.quality?.toUpperCase()
    return <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-gray-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div><div className="flex items-center gap-2"><Activity className="h-6 w-6 text-[#128C7E]" /><h2 className="text-2xl font-black">Account health</h2></div>
                <p className="mt-2 max-w-2xl text-sm text-gray-500">A read-only check before sending. “Not verified” means RSS does not have enough information to call that item healthy.</p>
                <p className="mt-2 text-xs text-gray-400">{health ? `Last checked ${new Date(health.checkedAt).toLocaleString()}` : "No check completed yet"} · This page does not send messages.</p>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{loading ? "Checking Meta…" : "Check now"}
            </button>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {!health && loading ? <p className="rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">Checking the phone number, business account and templates with Meta…</p> : null}
        {health ? <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <HealthCard title="Meta phone quality" value={quality === "GREEN" ? "High quality" : quality === "YELLOW" ? "Medium quality" : quality === "RED" ? "Low quality" : "Not available"} detail={health.phone.error ?? (quality === "NA" || !quality ? "Meta has not determined a rating. This is not a green health signal." : `Meta rates ${health.phone.display ?? "this number"} as ${quality?.toLowerCase()}. Customer blocks and reports can lower it.`)} explanation="This is Meta's rating of how customers react to messages from this number. Too many blocks or reports can lower it. Green is good; yellow or red needs attention. It does not show whether a specific customer gave permission." tone={quality === "GREEN" ? "good" : quality === "RED" || quality === "YELLOW" ? "warning" : "neutral"} />
                <HealthCard title="Verification code" value={health.phone.verification === "EXPIRED" ? "Past code expired" : health.phone.verification ?? "Not available"} detail={health.phone.error ?? `Phone connection: ${health.phone.status ?? "not returned"}. Meta display name: ${health.phone.verifiedName ?? "not returned"}.`} explanation={health.phone.verification === "EXPIRED" ? "A one-time code used to prove ownership of this phone number has expired. It does not mean your WhatsApp connection expired. Your phone's separate connection status is shown below; CONNECTED means Meta reports the number connected. Do not request a new code just because this old one expired." : "This refers to the one-time code used to prove you own the phone number. It is different from the phone's connection status, which is shown below. A verified code does not by itself prove that messages are being delivered."} tone={health.phone.verification === "VERIFIED" ? "good" : "neutral"} />
                <HealthCard title="Messaging limit" value={friendlyLimit(health.account.messagingLimit)} detail={health.account.error ?? "Meta's business-initiated conversation tier, not messages per second or a live remaining balance. It can change."} explanation="This is the size of the audience Meta currently allows RSS to start conversations with in a rolling 24-hour period. It is not the number of messages left today, and it is not a speed limit. Meta can change the tier." tone={health.account.messagingLimit ? "good" : "neutral"} />
                <HealthCard title="RSS connection" value={health.rss.connectionActive ? "Enabled in RSS" : "Paused in RSS"} detail="This checks RSS configuration only. It does not prove that Meta or WhatChimp will accept a message." explanation="This only tells you whether the WhatsApp connection switch inside RSS is on. It does not test whether Meta or WhatChimp will deliver a message. A small live test is still needed." tone={health.rss.connectionActive ? "neutral" : "warning"} />
                <HealthCard title="Campaign sending" value={health.rss.campaignWorkerConfigured ? "Worker configured" : "Worker not configured"} detail={health.rss.campaignWorkerConfigured ? "Credentials and feature switch exist. Scheduling and actual delivery still need a live test." : "Bulk campaigns cannot reliably run yet; the Send button remains disabled."} explanation="A campaign worker is the background process that sends a large audience in small batches. Configured means the RSS switch and secret exist; it does not mean scheduling or delivery has been tested. If it is not configured, bulk sending stays off." tone={health.rss.campaignWorkerConfigured ? "neutral" : "warning"} />
                <HealthCard title="Permission & delivery proof" value="Not verified" detail={`${health.rss.consentTracking} ${health.rss.deliveryTracking}`} explanation="RSS must be able to show that a customer agreed to receive WhatsApp messages. It also needs delivery reports to know what actually reached people. We cannot confirm both from the current records, so this is not marked healthy." />
            </div>
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-xl font-black">Template health</h3>
                <p className="mt-1 text-sm text-gray-500">Live Meta statuses. Only approved templates can be used for outbound template messages; category must match the message purpose.</p>
                {health.templates.error ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Could not verify templates: {health.templates.error}</p> : <>
                    <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{counts.APPROVED ?? 0} approved</span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{counts.PENDING ?? 0} pending</span>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-red-800">{(counts.REJECTED ?? 0) + (counts.PAUSED ?? 0) + (counts.DISABLED ?? 0)} need attention</span>
                    </div>
                    {health.templates.truncated ? <p className="mt-3 text-sm text-amber-700">Showing the first 1,000 templates; this is not a complete account count.</p> : null}
                    {health.templates.localOnly.length ? <p className="mt-3 text-sm text-amber-700">RSS has {health.templates.localOnly.length} submitted template(s) not found in this Meta check. Check the linked WABA and sync Templates.</p> : null}
                    <div className="mt-4 max-h-[500px] overflow-auto divide-y divide-gray-100 dark:divide-zinc-800">
                        {health.templates.items.length ? health.templates.items.map((template, index) => <div key={`${template.name}:${template.language}:${index}`} className="grid gap-2 py-3 text-sm md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center">
                            <div className="font-bold">{template.name}<span className="ml-2 font-normal text-gray-400">{template.language}</span></div>
                            <span>{template.category}</span><span className={template.status === "APPROVED" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{template.status}</span>
                            <span className="text-gray-500">Quality: {template.quality ?? "Not available"}{template.rejectionReason ? ` · Reason: ${template.rejectionReason}` : ""}</span>
                        </div>) : <p className="py-5 text-sm text-gray-500">Meta returned no templates for this business account.</p>}
                    </div>
                </>}
            </section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <p className="font-black">Before RSS can safely launch campaigns</p>
                <p className="mt-1">Confirm customer WhatsApp permission records, delivery/failure webhooks, a reliable batch worker, correct template category, and a small live test. A green quality rating alone is not permission to send.</p>
            </div>
        </> : null}
    </div>
}
