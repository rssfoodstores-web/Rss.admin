"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Activity,
    CheckCircle2,
    FileSpreadsheet,
    KeyRound,
    LayoutDashboard,
    Loader2,
    MessageCircleMore,
    RefreshCw,
    Settings2,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    saveWhatsAppAccess,
    saveWhatsAppConnection,
    testSavedWhatsAppConnection,
    type WhatsAppCenterPageData,
    type WhatsAppTeamRecord,
} from "./actions"
import { ChatWorkspace } from "./ChatWorkspace"
import { AccountHealthWorkspace } from "./AccountHealthWorkspace"
import { WhatsAppQuotaBanner } from "./WhatsAppQuotaBanner"
import { SecureCsvCampaignWorkspace } from "./SecureCsvCampaignWorkspace"
import { TemplateWorkspace } from "./TemplateWorkspace"

type TabKey = "builder" | "campaigns" | "health" | "home" | "send" | "settings" | "templates"

const tabs: Array<{ icon: typeof LayoutDashboard; key: TabKey; label: string }> = [
    { icon: LayoutDashboard, key: "home", label: "Home" },
    { icon: MessageCircleMore, key: "send", label: "Chat with customers" },
    { icon: Sparkles, key: "templates", label: "Templates" },
    { icon: ShieldCheck, key: "health", label: "Account health" },
    { icon: FileSpreadsheet, key: "builder", label: "CSV Builder" },
    { icon: Activity, key: "campaigns", label: "Campaigns" },
    { icon: Settings2, key: "settings", label: "Team & settings" },
]

function runAction(
    action: () => Promise<{ error?: string; success?: true }>,
    successMessage: string,
    router: ReturnType<typeof useRouter>,
    startTransition: React.TransitionStartFunction
) {
    startTransition(() => {
        void (async () => {
            try {
                const result = await action()
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success(successMessage)
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Something went wrong.")
            }
        })()
    })
}

function StatCard({ icon: Icon, label, value, help }: {
    help: string
    icon: typeof Users
    label: string
    value: number
}) {
    return (
        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-black text-gray-900 dark:text-white">{value.toLocaleString()}</span>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{help}</p>
        </div>
    )
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <section className={cn("rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", className)}>
            {children}
        </section>
    )
}

function StatusBadge({ status }: { status: string }) {
    const good = ["approved", "connected", "completed", "delivered", "read", "sent"].includes(status)
    const bad = ["failed", "rejected"].includes(status)
    return (
        <Badge className={cn(
            "capitalize",
            good && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
            bad && "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300",
            !good && !bad && "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
        )}>
            {status}
        </Badge>
    )
}

function TeamAccessRow({ member }: { member: WhatsAppTeamRecord }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [accessLevel, setAccessLevel] = useState(member.accessLevel)
    const [templates, setTemplates] = useState(member.canManageTemplates)
    const [campaigns, setCampaigns] = useState(member.canSendCampaigns)
    const isOwner = member.accessLevel === "owner"

    return (
        <div className="grid gap-4 border-b border-gray-100 py-5 last:border-0 dark:border-zinc-800 lg:grid-cols-[1fr_170px_1.4fr_auto] lg:items-center">
            <div>
                <p className="font-bold text-gray-900 dark:text-white">{member.fullName}</p>
                <p className="text-xs capitalize text-gray-500">{member.role.replace("_", " ")}</p>
            </div>
            <select
                value={accessLevel}
                disabled={isOwner || isPending}
                onChange={(event) => setAccessLevel(event.target.value as typeof accessLevel)}
                className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
                {isOwner ? <option value="owner">Owner</option> : null}
                <option value="none">No access</option>
                <option value="operator">Operator</option>
                <option value="manager">Manager</option>
            </select>
            <div className="flex flex-wrap gap-3 text-xs">
                {[
                    { checked: templates, label: "Templates", setChecked: setTemplates },
                    { checked: campaigns, label: "Campaigns", setChecked: setCampaigns },
                ].map((permission) => (
                    <label key={permission.label} className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 dark:border-zinc-700">
                        <input
                            type="checkbox"
                            checked={permission.checked}
                            disabled={isOwner || accessLevel === "none" || accessLevel === "manager" || isPending}
                            onChange={(event) => permission.setChecked(event.target.checked)}
                        />
                        {permission.label}
                    </label>
                ))}
            </div>
            <Button
                type="button"
                variant="outline"
                disabled={isOwner || isPending}
                onClick={() => runAction(
                    () => saveWhatsAppAccess({
                        accessLevel: accessLevel === "owner" ? "none" : accessLevel,
                        canManageContacts: member.canManageContacts,
                        canManageTemplates: templates,
                        canSendCampaigns: campaigns,
                        userId: member.userId,
                    }),
                    "WhatsApp access updated.",
                    router,
                    startTransition
                )}
            >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
            </Button>
        </div>
    )
}

export function WhatsAppCenterClient({ initialData }: { initialData: WhatsAppCenterPageData }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [activeTab, setActiveTab] = useState<TabKey>(initialData.connection ? "home" : "settings")
    const [connectionForm, setConnectionForm] = useState({
        accountLabel: initialData.connection?.accountLabel ?? "RSS Foods WhatsApp",
        apiToken: "",
        graphApiVersion: initialData.connection?.graphApiVersion ?? "v24.0",
        isActive: initialData.connection?.isActive ?? true,
        metaAccessToken: "",
        phoneNumberId: initialData.connection?.phoneNumberId ?? "",
        wabaId: initialData.connection?.wabaId ?? "",
    })
    const [testPhone, setTestPhone] = useState("")
    const visibleTabs = tabs.filter((tab) => {
        if (tab.key === "settings") return initialData.access.canManageSettings
        if (tab.key === "templates") return initialData.access.canManageTemplates
        if (tab.key === "campaigns" || tab.key === "builder") return initialData.access.canSendCampaigns
        return true
    })

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                                <MessageCircleMore className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Powered by WhatChimp + Meta</p>
                                <h1 className="mt-1 text-3xl font-black">RSS WhatsApp Center</h1>
                            </div>
                        </div>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80">
                            Customers, templates, messages and campaigns in one simple workspace. Follow the numbered steps and RSS is ready to send.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-start gap-3">
                    <WhatsAppQuotaBanner />
                    <div className="flex items-center gap-3 rounded-2xl bg-black/15 px-4 py-3 backdrop-blur">
                        <span className={cn("h-3 w-3 rounded-full", initialData.connection?.isActive ? "bg-lime-300" : "bg-amber-300")} />
                        <div>
                            <p className="text-xs text-white/70">Connection</p>
                            <p className="font-bold">{initialData.connection?.isActive ? "Ready" : "Setup needed"}</p>
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition",
                            activeTab === tab.key
                                ? "bg-[#128C7E] text-white shadow-sm"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {!initialData.connection ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                    <p className="font-bold">One quick setup remains</p>
                    <p className="mt-1 text-sm">Enter the WhatChimp API token and phone-number ID in Team & settings. Secrets will be encrypted before storage.</p>
                </div>
            ) : null}

            {activeTab === "home" ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <StatCard icon={Sparkles} label="Approved templates" value={initialData.stats.approvedTemplates} help="Available for campaigns" />
                        <StatCard icon={CheckCircle2} label="Delivered" value={initialData.stats.deliveredMessages} help="Recent RSS message log" />
                        <StatCard icon={Activity} label="Failed" value={initialData.stats.failedMessages} help="Messages needing attention" />
                    </div>
                    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                        <SectionCard>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Three-step workflow</h2>
                            <div className="mt-5 space-y-4">
                                {[
                                    ["1", "Choose an audience", "Build an audience from RSS data or upload a CSV."],
                                    ["2", "Prepare a template", "Use friendly variables like {{customer_name}}."],
                                    ["3", "Send confidently", "Preview, select consented customers and send."],
                                ].map(([number, title, description]) => (
                                    <div key={number} className="flex gap-4 rounded-2xl bg-gray-50 p-4 dark:bg-zinc-800/60">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] font-black text-white">{number}</div>
                                        <div><p className="font-bold">{title}</p><p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{description}</p></div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                        <SectionCard>
                            <div className="flex items-center justify-between gap-4">
                                <div><h2 className="text-xl font-black">Recent activity</h2><p className="mt-1 text-sm text-gray-500">Latest outgoing message results</p></div>
                                <Button variant="outline" onClick={() => setActiveTab("send")}>Open customer chats</Button>
                            </div>
                            <div className="mt-5 divide-y divide-gray-100 dark:divide-zinc-800">
                                {initialData.messages.length ? initialData.messages.slice(0, 6).map((message) => (
                                    <div key={message.id} className="flex items-start justify-between gap-4 py-4">
                                        <div className="min-w-0"><p className="font-semibold">{message.contactName ?? "Customer"}</p><p className="mt-1 truncate text-sm text-gray-500">{message.body}</p></div>
                                        <StatusBadge status={message.status} />
                                    </div>
                                )) : <p className="py-10 text-center text-sm text-gray-500">No messages have been sent from RSS yet.</p>}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            ) : null}

            {activeTab === "send" ? <ChatWorkspace data={initialData} /> : null}

            {activeTab === "templates" ? <TemplateWorkspace canSync={Boolean(initialData.connection?.hasMetaToken)} templates={initialData.templates} /> : null}

            {activeTab === "health" ? <AccountHealthWorkspace /> : null}

            {activeTab === "builder" ? <SecureCsvCampaignWorkspace campaigns={initialData.campaigns} mode="builder" templates={initialData.templates} workerConfigured={initialData.campaignWorkerConfigured} /> : null}

            {activeTab === "campaigns" ? <SecureCsvCampaignWorkspace campaigns={initialData.campaigns} mode="campaign" templates={initialData.templates} workerConfigured={initialData.campaignWorkerConfigured} /> : null}

            {activeTab === "settings" && initialData.access.canManageSettings ? (
                <div className="space-y-6">
                    {initialData.connection?.webhookUrl ? <SectionCard><p className="font-black text-emerald-950 dark:text-emerald-100">Receive customer replies in RSS</p><p className="mt-1 text-sm text-gray-500">Paste this URL into WhatChimp’s “Trigger Webhook for Incoming Message” setting. Click the box to select the complete URL.</p><Input className="mt-4" readOnly value={initialData.connection.webhookUrl} onFocus={(event) => event.currentTarget.select()} /></SectionCard> : null}
                    <SectionCard><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#128C7E]"><KeyRound className="h-5 w-5" /></div><div><h2 className="text-2xl font-black">Connection settings</h2><p className="mt-1 text-sm text-gray-500">Only the Supa Admin can see this section. Saved tokens are encrypted and are never displayed again.</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="space-y-2"><span className="text-sm font-bold">Account label</span><Input value={connectionForm.accountLabel} onChange={(event) => setConnectionForm((current) => ({ ...current, accountLabel: event.target.value }))} /></label><label className="space-y-2"><span className="text-sm font-bold">Phone number ID</span><Input value={connectionForm.phoneNumberId} onChange={(event) => setConnectionForm((current) => ({ ...current, phoneNumberId: event.target.value }))} /></label><label className="space-y-2"><span className="text-sm font-bold">WhatChimp API token</span><Input type="password" autoComplete="new-password" value={connectionForm.apiToken} onChange={(event) => setConnectionForm((current) => ({ ...current, apiToken: event.target.value }))} placeholder={initialData.connection?.hasApiToken ? "Saved securely — leave blank to keep" : "Paste token"} /></label><label className="space-y-2"><span className="text-sm font-bold">Meta WABA ID</span><Input value={connectionForm.wabaId} onChange={(event) => setConnectionForm((current) => ({ ...current, wabaId: event.target.value }))} placeholder="Needed for template submission" /></label><label className="space-y-2"><span className="text-sm font-bold">Meta access token</span><Input type="password" autoComplete="new-password" value={connectionForm.metaAccessToken} onChange={(event) => setConnectionForm((current) => ({ ...current, metaAccessToken: event.target.value }))} placeholder={initialData.connection?.hasMetaToken ? "Saved securely — leave blank to keep" : "Needed for templates and campaigns"} /></label><label className="space-y-2"><span className="text-sm font-bold">Graph API version</span><Input value={connectionForm.graphApiVersion} onChange={(event) => setConnectionForm((current) => ({ ...current, graphApiVersion: event.target.value }))} /></label><label className="flex items-center gap-3"><input type="checkbox" checked={connectionForm.isActive} onChange={(event) => setConnectionForm((current) => ({ ...current, isActive: event.target.checked }))} /><span className="text-sm font-bold">Connection active</span></label></div><div className="mt-6 flex flex-wrap gap-3"><Button disabled={isPending} className="bg-[#128C7E]" onClick={() => runAction(() => saveWhatsAppConnection(connectionForm), "Connection saved securely.", router, startTransition)}><ShieldCheck className="mr-2 h-4 w-4" />Save connection</Button><Input className="max-w-xs" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="Test phone with country code" /><Button variant="outline" disabled={isPending || !initialData.connection} onClick={() => runAction(() => testSavedWhatsAppConnection(testPhone), "WhatChimp connection verified.", router, startTransition)}><RefreshCw className="mr-2 h-4 w-4" />Test safely</Button></div>{initialData.connection?.lastTestStatus ? <div className="mt-4 flex items-center gap-3 text-sm"><StatusBadge status={initialData.connection.lastTestStatus} /><span className="text-gray-500">{initialData.connection.lastTestMessage}</span></div> : null}</SectionCard>
                    <SectionCard><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Users className="h-5 w-5" /></div><div><h2 className="text-2xl font-black">Who can use WhatsApp Center?</h2><p className="mt-1 text-sm text-gray-500">Supa Admin controls access. Managers receive all working permissions; operators can be limited.</p></div></div><div className="mt-5">{initialData.team.map((member) => <TeamAccessRow key={member.userId} member={member} />)}</div></SectionCard>
                </div>
            ) : null}
        </div>
    )
}
