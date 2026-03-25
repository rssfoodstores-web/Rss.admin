"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Bot, CheckCircle2, Clock3, Copy, Loader2, Mail, MessageSquareText, Phone, Power, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import {
    extractSupportSuggestedLinks,
    getSupportStatusLabel,
    getSupportStatusTone,
    type SupportAISettings,
    type SupportMessageRecord,
    type SupportConversationStatus,
} from "@/lib/supportChat"
import { cn } from "@/lib/utils"
import {
    loadSupportAdminPageData,
    sendSupportAdminReply,
    updateSupportAiSettings,
    updateSupportConversationStatus,
    type SupportAdminPageData,
} from "./actions"

interface SupportAdminClientProps {
    initialData: SupportAdminPageData
}

function formatPercent(value: number) {
    return `${value.toFixed(1)}%`
}

function formatResponseTime(value: number | null) {
    if (value === null) {
        return "No AI replies yet"
    }

    if (value < 1000) {
        return `${value} ms`
    }

    return `${(value / 1000).toFixed(1)} s`
}

function formatStamp(value: string) {
    return new Date(value).toLocaleString([], {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
    })
}

function getAdminMessageTone(message: SupportMessageRecord) {
    switch (message.senderRole) {
        case "customer":
            return "self-start border-gray-200 bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        case "assistant":
            return "self-start border-orange-100 bg-orange-50 text-gray-900 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-50"
        case "admin":
            return "self-end border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-50"
        case "system":
        default:
            return "self-start border-gray-200 bg-gray-100 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    }
}

function getAdminMessageLabel(message: SupportMessageRecord) {
    switch (message.senderRole) {
        case "assistant":
            return "AI support"
        case "admin":
            return "Support team"
        case "system":
            return "System"
        case "customer":
        default:
            return "Customer"
    }
}

function buildCopyBlock(data: SupportAdminPageData["selectedSnapshot"]) {
    if (!data) {
        return ""
    }

    return [
        `Name: ${data.conversation.visitorName}`,
        `Email: ${data.conversation.visitorEmail}`,
        `Phone: ${data.conversation.visitorPhone ?? "Not provided"}`,
        `Subject: ${data.conversation.subject ?? "Not provided"}`,
    ].join("\n")
}

export function SupportAdminClient({ initialData }: SupportAdminClientProps) {
    const supabase = useMemo(() => createClient(), [])
    const [data, setData] = useState(initialData)
    const [settings, setSettings] = useState<SupportAISettings>(initialData.settings)
    const [settingsDirty, setSettingsDirty] = useState(false)
    const [replyDraft, setReplyDraft] = useState("")
    const [markResolved, setMarkResolved] = useState(false)
    const [isPending, startTransition] = useTransition()
    const refreshTimerRef = useRef<number | null>(null)

    const selectedSnapshot = data.selectedSnapshot

    useEffect(() => {
        const scheduleRefresh = () => {
            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current)
            }

            refreshTimerRef.current = window.setTimeout(() => {
                refreshTimerRef.current = null

                startTransition(async () => {
                    try {
                        const nextData = await loadSupportAdminPageData(data.selectedConversationId)
                        setData(nextData)
                        if (!settingsDirty) {
                            setSettings(nextData.settings)
                        }
                    } catch (error) {
                        console.error("Support admin refresh failed:", error)
                    }
                })
            }, 250)
        }

        const channel = supabase
            .channel("admin-support-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, scheduleRefresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, scheduleRefresh)

        channel.subscribe()

        return () => {
            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current)
            }

            supabase.removeChannel(channel)
        }
    }, [data.selectedConversationId, settingsDirty, startTransition, supabase])

    async function refreshData(selectedConversationId?: string | null) {
        const nextData = await loadSupportAdminPageData(selectedConversationId ?? data.selectedConversationId)
        setData(nextData)
        if (!settingsDirty) {
            setSettings(nextData.settings)
        }
    }

    function handleConversationSelect(conversationId: string) {
        if (conversationId === data.selectedConversationId) {
            return
        }

        setReplyDraft("")
        setMarkResolved(false)

        startTransition(async () => {
            try {
                await refreshData(conversationId)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to load conversation.")
            }
        })
    }

    function handleSaveSettings() {
        startTransition(async () => {
            try {
                await updateSupportAiSettings(settings)
                setSettingsDirty(false)
                toast.success("Support AI settings updated.")
                await refreshData(data.selectedConversationId)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update support settings.")
            }
        })
    }

    function handleStatusChange(nextStatus: string) {
        if (!selectedSnapshot) {
            return
        }

        startTransition(async () => {
            try {
                await updateSupportConversationStatus(selectedSnapshot.conversation.id, nextStatus as SupportConversationStatus)
                toast.success("Support conversation status updated.")
                await refreshData(selectedSnapshot.conversation.id)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update support status.")
            }
        })
    }

    function handleReplySend() {
        if (!selectedSnapshot) {
            return
        }

        startTransition(async () => {
            try {
                await sendSupportAdminReply({
                    body: replyDraft,
                    conversationId: selectedSnapshot.conversation.id,
                    markResolved,
                })
                setReplyDraft("")
                setMarkResolved(false)
                toast.success("Reply sent to the support conversation.")
                await refreshData(selectedSnapshot.conversation.id)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to send reply.")
            }
        })
    }

    function handleCopyDetails() {
        if (!selectedSnapshot) {
            return
        }

        void navigator.clipboard.writeText(buildCopyBlock(selectedSnapshot))
            .then(() => {
                toast.success("Customer details copied.")
            })
            .catch(() => {
                toast.error("Could not copy customer details.")
            })
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                        <Power className="h-4 w-4" />
                        <span>AI status</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold">{settings.enabled ? "Enabled" : "Paused"}</p>
                    <p className="mt-2 text-sm text-white/80">New chat turns use Gemini only while AI is enabled.</p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <MessageSquareText className="h-4 w-4" />
                        <span>Total conversations</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{data.stats.totalConversations.toLocaleString()}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        Open: {data.stats.openCount.toLocaleString()} | Human follow-up: {data.stats.humanFollowUpCount.toLocaleString()}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Bot className="h-4 w-4" />
                        <span>AI resolved rate</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(data.stats.resolvedByAiRate)}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Escalation rate: {formatPercent(data.stats.escalationRate)}</p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Clock3 className="h-4 w-4" />
                        <span>Average AI response</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatResponseTime(data.stats.averageAiResponseTimeMs)}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Based on the latest logged AI replies.</p>
                </div>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#F58220]" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support AI settings</h2>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                    Toggle Gemini on or off and control the copy customers see in the contact-page chat.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">AI mode</span>
                        <select
                            value={settings.enabled ? "enabled" : "disabled"}
                            onChange={(event) => {
                                setSettingsDirty(true)
                                setSettings((current) => ({ ...current, enabled: event.target.value === "enabled" }))
                            }}
                            className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                        >
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Assistant name</span>
                        <Input
                            value={settings.assistantName}
                            onChange={(event) => {
                                setSettingsDirty(true)
                                setSettings((current) => ({ ...current, assistantName: event.target.value }))
                            }}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Welcome title</span>
                        <Input
                            value={settings.welcomeTitle}
                            onChange={(event) => {
                                setSettingsDirty(true)
                                setSettings((current) => ({ ...current, welcomeTitle: event.target.value }))
                            }}
                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Welcome message</span>
                        <Textarea
                            value={settings.welcomeMessage}
                            onChange={(event) => {
                                setSettingsDirty(true)
                                setSettings((current) => ({ ...current, welcomeMessage: event.target.value }))
                            }}
                            className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-900"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Handoff message</span>
                        <Textarea
                            value={settings.handoffMessage}
                            onChange={(event) => {
                                setSettingsDirty(true)
                                setSettings((current) => ({ ...current, handoffMessage: event.target.value }))
                            }}
                            className="min-h-24 rounded-2xl bg-gray-50 dark:bg-zinc-900"
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        className="rounded-full bg-[#F58220] px-6 text-white hover:bg-[#F58220]/90"
                        onClick={handleSaveSettings}
                        disabled={isPending}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save support settings
                    </Button>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support conversations</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                            Every contact-page chat appears here, including AI-only and human-follow-up threads.
                        </p>
                    </div>

                    <div className="max-h-[820px] space-y-3 overflow-y-auto p-4">
                        {data.conversations.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                                No support chats have started yet.
                            </div>
                        ) : (
                            data.conversations.map((conversation) => (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => handleConversationSelect(conversation.id)}
                                    className={cn(
                                        "w-full rounded-2xl border p-4 text-left transition",
                                        conversation.id === data.selectedConversationId
                                            ? "border-[#F58220] bg-orange-50 dark:border-orange-500/60 dark:bg-orange-950/20"
                                            : "border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-semibold text-gray-900 dark:text-white">{conversation.visitorName}</p>
                                                <span className={cn("rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", getSupportStatusTone(conversation.status))}>
                                                    {getSupportStatusLabel(conversation.status)}
                                                </span>
                                            </div>
                                            <p className="mt-2 truncate text-sm text-gray-500 dark:text-zinc-400">{conversation.visitorEmail}</p>
                                            <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-zinc-300">
                                                {conversation.lastMessagePreview ?? "No message preview available."}
                                            </p>
                                        </div>
                                        {conversation.resolvedByAi ? (
                                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                AI
                                            </span>
                                        ) : conversation.escalatedToHuman ? (
                                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                                                Human
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400 dark:text-zinc-500">
                                        <span>{conversation.subject || "No subject"}</span>
                                        <span>{formatStamp(conversation.lastMessageAt)}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </section>

                <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {selectedSnapshot ? (
                        <div className="flex h-full flex-col">
                            <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedSnapshot.conversation.visitorName}</h2>
                                            <span className={cn("rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]", getSupportStatusTone(selectedSnapshot.conversation.status))}>
                                                {getSupportStatusLabel(selectedSnapshot.conversation.status)}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                            Started {formatStamp(selectedSnapshot.conversation.createdAt)}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <select
                                            value={selectedSnapshot.conversation.status}
                                            onChange={(event) => handleStatusChange(event.target.value)}
                                            className="h-11 rounded-full border border-gray-200 bg-white px-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                        >
                                            <option value="open">Open</option>
                                            <option value="human_follow_up">Human follow-up</option>
                                            <option value="resolved">Resolved</option>
                                        </select>

                                        <Button type="button" variant="outline" className="rounded-full" onClick={handleCopyDetails}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy details
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200">
                                            <Mail className="h-4 w-4 text-[#F58220]" />
                                            <span>Email</span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{selectedSnapshot.conversation.visitorEmail}</p>
                                    </div>

                                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200">
                                            <Phone className="h-4 w-4 text-[#F58220]" />
                                            <span>Phone</span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{selectedSnapshot.conversation.visitorPhone || "Not provided"}</p>
                                    </div>

                                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200">
                                            <CheckCircle2 className="h-4 w-4 text-[#F58220]" />
                                            <span>Subject</span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{selectedSnapshot.conversation.subject || "Not provided"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                <div className="flex flex-col gap-3">
                                    {selectedSnapshot.messages.map((message) => {
                                        const links = extractSupportSuggestedLinks(message.metadata)

                                        return (
                                            <div key={message.id} className={cn("max-w-[88%] rounded-3xl border px-4 py-3", getAdminMessageTone(message))}>
                                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
                                                    <span>{getAdminMessageLabel(message)}</span>
                                                    <span>{formatStamp(message.createdAt)}</span>
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                                                {links.length > 0 ? (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {links.map((link) => (
                                                            <span key={`${message.id}-${link.url}`} className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">
                                                                {link.label}: {link.url}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 px-6 py-5 dark:border-zinc-800">
                                <div className="space-y-3">
                                    <Textarea
                                        value={replyDraft}
                                        onChange={(event) => setReplyDraft(event.target.value)}
                                        placeholder="Reply to the customer in this live chat thread..."
                                        className="min-h-[120px] rounded-2xl bg-gray-50 dark:bg-zinc-950"
                                    />
                                    <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-zinc-300">
                                        <input
                                            type="checkbox"
                                            checked={markResolved}
                                            onChange={(event) => setMarkResolved(event.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        Mark the conversation as resolved after sending this reply
                                    </label>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-gray-400">
                                            Admin replies appear to the customer in the same contact-page chat bubble.
                                        </p>
                                        <Button
                                            type="button"
                                            className="rounded-full bg-[#F58220] px-5 text-white hover:bg-[#F58220]/90"
                                            onClick={handleReplySend}
                                            disabled={isPending || !replyDraft.trim()}
                                        >
                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                            Send reply
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[520px] items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-zinc-400">
                            Select a support conversation to review the thread and reply.
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
