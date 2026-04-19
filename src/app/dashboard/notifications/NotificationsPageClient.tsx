"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Filter, Loader2, Send, Users, UserRound } from "lucide-react"
import { sendUserMessage } from "@/actions/notifications"
import type {
    NotificationHistoryItem,
    NotificationRecipientDirectoryItem,
    NotificationRecipientRole,
    NotificationRoleSummary,
} from "@/lib/admin-notifications"
import { getNotificationRoleLabel } from "@/lib/admin-notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface NotificationsPageClientProps {
    initialHistory: NotificationHistoryItem[]
    recipientDirectory: NotificationRecipientDirectoryItem[]
    roleSummaries: NotificationRoleSummary[]
    totalRecipients: number
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

function getRecipientLabel(user: NotificationRecipientDirectoryItem | null) {
    if (!user) {
        return "Selected user"
    }

    return user.full_name?.trim()
        || user.company_name?.trim()
        || user.phone?.trim()
        || user.id.slice(0, 8)
}

function getRecipientMeta(user: NotificationRecipientDirectoryItem) {
    return user.phone?.trim()
        || user.company_name?.trim()
        || user.id
}

function normalizeSearchValue(value: string) {
    return value.trim().toLowerCase()
}

export function NotificationsPageClient({
    initialHistory,
    recipientDirectory,
    roleSummaries,
    totalRecipients,
}: NotificationsPageClientProps) {
    const searchParams = useSearchParams()
    const urlUserId = searchParams.get("userId")
    const { toast } = useToast()
    const preselectedUser = recipientDirectory.find((recipient) => recipient.id === urlUserId) ?? null
    const [history, setHistory] = useState(initialHistory)
    const [loading, setLoading] = useState(false)
    const [audience, setAudience] = useState<"single" | "all" | "role">(preselectedUser ? "single" : "single")
    const [selectedUser, setSelectedUser] = useState<NotificationRecipientDirectoryItem | null>(preselectedUser)
    const [pickerRoleFilter, setPickerRoleFilter] = useState<NotificationRecipientRole | "all">("all")
    const [targetRole, setTargetRole] = useState<NotificationRecipientRole | "customer">("rider")
    const [searchQuery, setSearchQuery] = useState("")
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")
    const [actionUrl, setActionUrl] = useState("")

    const filteredRecipients = useMemo(() => {
        const normalizedQuery = normalizeSearchValue(searchQuery)

        return recipientDirectory
            .filter((recipient) => pickerRoleFilter === "all" || recipient.roles.includes(pickerRoleFilter))
            .filter((recipient) => {
                if (!normalizedQuery) {
                    return true
                }

                const haystack = [
                    recipient.full_name,
                    recipient.company_name,
                    recipient.phone,
                    recipient.id,
                    recipient.roles.join(" "),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()

                return haystack.includes(normalizedQuery)
            })
    }, [pickerRoleFilter, recipientDirectory, searchQuery])

    const visibleRecipients = useMemo(() => filteredRecipients.slice(0, 12), [filteredRecipients])

    const selectedRoleSummary = useMemo(
        () => roleSummaries.find((summary) => summary.role === targetRole) ?? null,
        [roleSummaries, targetRole]
    )

    const audienceSummary = useMemo(() => {
        if (audience === "all") {
            return `Broadcast to all ${totalRecipients.toLocaleString()} account${totalRecipients === 1 ? "" : "s"}`
        }

        if (audience === "role") {
            return `Notify all ${getNotificationRoleLabel(targetRole).toLowerCase()}`
        }

        return selectedUser ? `Direct notification to ${getRecipientLabel(selectedUser)}` : "Choose one existing user"
    }, [audience, selectedUser, targetRole, totalRecipients])

    async function handleSend(event: React.FormEvent) {
        event.preventDefault()

        if (audience === "single" && !selectedUser) {
            toast({
                title: "Recipient required",
                description: "Select an existing user before sending.",
                variant: "destructive",
            })
            return
        }

        if (audience === "role" && !targetRole) {
            toast({
                title: "Role required",
                description: "Choose which role should receive this notification.",
                variant: "destructive",
            })
            return
        }

        setLoading(true)

        const formData = new FormData()
        formData.append("audience", audience)
        if (selectedUser) {
            formData.append("userId", selectedUser.id)
        }
        if (audience === "role") {
            formData.append("targetRole", targetRole)
        }
        formData.append("title", title)
        formData.append("message", message)
        formData.append("action_url", actionUrl)

        const result = await sendUserMessage({}, formData)

        if (result.message === "success") {
            toast({
                title: "Notification sent",
                description: audience === "all"
                    ? `Broadcast delivered to ${result.sentCount ?? totalRecipients} users.`
                    : audience === "role"
                        ? `Notification delivered to ${result.sentCount ?? 0} ${getNotificationRoleLabel(targetRole).toLowerCase()}.`
                        : `Notification sent to ${getRecipientLabel(selectedUser)}.`,
            })

            if (result.historyEntry) {
                setHistory((current) => [result.historyEntry!, ...current].slice(0, 30))
            }

            setTitle("")
            setMessage("")
            setActionUrl("")
            if (audience === "single") {
                setSearchQuery("")
            }
        } else {
            toast({
                title: "Send failed",
                description: result.message || "The notification could not be sent.",
                variant: "destructive",
            })
        }

        setLoading(false)
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Notifications Center</h1>
                <p className="text-muted-foreground">Send to one existing user, a full role group, or every account in the system.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recipients</div>
                        <div className="mt-3 text-3xl font-bold">{totalRecipients.toLocaleString()}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Profiles that can receive admin notifications.</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent sends</div>
                        <div className="mt-3 text-3xl font-bold">{history.length.toLocaleString()}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Grouped sends loaded from recent notification rows.</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mode</div>
                        <div className="mt-3 text-3xl font-bold">
                            {audience === "all" ? "Broadcast" : audience === "role" ? "Role group" : "Direct"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{audienceSummary}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Audience</CardTitle>
                        <CardDescription>Pick one user, target a whole role, or send to everybody.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-3 lg:grid-cols-3">
                            <button
                                type="button"
                                onClick={() => setAudience("single")}
                                className={`rounded-2xl border p-4 text-left transition ${audience === "single" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                            >
                                <div className="flex items-center gap-2 font-semibold">
                                    <UserRound className="h-4 w-4" />
                                    Specific user
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">Choose from existing users and send a direct notification.</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAudience("role")
                                    setSelectedUser(null)
                                }}
                                className={`rounded-2xl border p-4 text-left transition ${audience === "role" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                            >
                                <div className="flex items-center gap-2 font-semibold">
                                    <Filter className="h-4 w-4" />
                                    Role group
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">Notify everyone with a role like riders, merchants, or agents.</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAudience("all")
                                    setSelectedUser(null)
                                }}
                                className={`rounded-2xl border p-4 text-left transition ${audience === "all" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                            >
                                <div className="flex items-center gap-2 font-semibold">
                                    <Users className="h-4 w-4" />
                                    Broadcast all
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">Insert one notification row for every profile in the system.</div>
                            </button>
                        </div>

                        {audience === "single" ? (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                                    <div className="space-y-2">
                                        <Label htmlFor="recipient-search">Find an existing user</Label>
                                        <Input
                                            id="recipient-search"
                                            placeholder="Search by name, company, phone, or ID..."
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="recipient-role-filter">Filter user list by role</Label>
                                        <select
                                            id="recipient-role-filter"
                                            value={pickerRoleFilter}
                                            onChange={(event) => setPickerRoleFilter(event.target.value as NotificationRecipientRole | "all")}
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="all">All roles</option>
                                            {roleSummaries.map((summary) => (
                                                <option key={summary.role} value={summary.role}>
                                                    {summary.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="rounded-2xl border">
                                    <div className="border-b px-4 py-3 text-sm text-muted-foreground">
                                        {filteredRecipients.length === 0
                                            ? "No users match the current search."
                                            : `Showing ${Math.min(visibleRecipients.length, filteredRecipients.length)} of ${filteredRecipients.length} matching users.`}
                                    </div>
                                    <div className="max-h-[320px] divide-y overflow-y-auto">
                                        {visibleRecipients.length > 0 ? visibleRecipients.map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                className={`flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted ${selectedUser?.id === user.id ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                                                onClick={() => setSelectedUser(user)}
                                            >
                                                <div className="space-y-1">
                                                    <div className="font-medium">{getRecipientLabel(user)}</div>
                                                    <div className="text-sm text-muted-foreground">{getRecipientMeta(user)}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {user.roles.map((role) => (
                                                            <Badge key={`${user.id}-${role}`} variant="outline">{getNotificationRoleLabel(role)}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Badge variant={selectedUser?.id === user.id ? "default" : "outline"}>
                                                    {selectedUser?.id === user.id ? "Selected" : "Select"}
                                                </Badge>
                                            </button>
                                        )) : (
                                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                                No users available for the current filter.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedUser ? (
                                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                                        <div className="mb-2 flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">{getRecipientLabel(selectedUser)}</div>
                                                <div className="text-sm text-muted-foreground">{getRecipientMeta(selectedUser)}</div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-auto px-2 py-1" onClick={() => setSelectedUser(null)}>
                                                Clear
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedUser.roles.map((role) => (
                                                <Badge key={`selected-${role}`} variant="outline">{getNotificationRoleLabel(role)}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {audience === "role" ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="target-role">Send to users by role</Label>
                                    <select
                                        id="target-role"
                                        value={targetRole}
                                        onChange={(event) => setTargetRole(event.target.value as NotificationRecipientRole)}
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        {roleSummaries.map((summary) => (
                                            <option key={summary.role} value={summary.role}>
                                                {summary.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {roleSummaries.map((summary) => (
                                        <button
                                            key={summary.role}
                                            type="button"
                                            onClick={() => setTargetRole(summary.role)}
                                            className={`rounded-2xl border p-4 text-left transition ${targetRole === summary.role ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                                        >
                                            <div className="font-semibold">{summary.label}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                {summary.count.toLocaleString()} matching profile{summary.count === 1 ? "" : "s"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-muted-foreground dark:border-orange-900 dark:bg-orange-950/20">
                                    This will send one notification to every user whose role includes <span className="font-semibold text-foreground">{getNotificationRoleLabel(targetRole)}</span>.
                                    {selectedRoleSummary ? ` Current match count: ${selectedRoleSummary.count.toLocaleString()}.` : ""}
                                </div>
                            </div>
                        ) : null}

                        {audience === "all" ? (
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-muted-foreground dark:border-orange-900 dark:bg-orange-950/20">
                                This will broadcast the same notification to all {totalRecipients.toLocaleString()} profiles currently stored in the system.
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Compose</CardTitle>
                        <CardDescription>Users receive these in their account notifications page and real-time bridge.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSend} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Important update" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    placeholder="Write the notification body here..."
                                    className="min-h-[160px]"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="action-url">Action link</Label>
                                <Input
                                    id="action-url"
                                    value={actionUrl}
                                    onChange={(event) => setActionUrl(event.target.value)}
                                    placeholder="/account/orders or https://example.com"
                                />
                                <p className="text-xs text-muted-foreground">Optional. If provided, clicking the notification can open this path or URL.</p>
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-orange-500 text-white hover:bg-orange-600"
                                disabled={loading || (audience === "single" && !selectedUser)}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {audience === "all" ? "Broadcast notification" : audience === "role" ? `Send to ${getNotificationRoleLabel(targetRole)}` : "Send notification"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent notification batches</CardTitle>
                    <CardDescription>Grouped send history from recent notification rows in the database.</CardDescription>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                            No admin notifications have been sent yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((item) => (
                                <div key={item.batchId} className="rounded-2xl border p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="font-semibold">{item.title}</div>
                                                <Badge variant="outline">
                                                    {item.audience === "all" ? "Broadcast" : item.audience === "role" ? "Role group" : "Direct"}
                                                </Badge>
                                                {item.targetRole ? <Badge variant="outline">{getNotificationRoleLabel(item.targetRole)}</Badge> : null}
                                                <Badge variant="outline">{item.recipientCount} recipient{item.recipientCount === 1 ? "" : "s"}</Badge>
                                                {item.unreadCount > 0 ? <Badge variant="outline">{item.unreadCount} unread</Badge> : null}
                                            </div>
                                            <div className="text-sm text-muted-foreground">{item.type || "admin_message"}{item.actionUrl ? ` · ${item.actionUrl}` : ""}</div>
                                            <div className="text-sm text-foreground/80">{item.message}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {item.recipientLabels.join(", ")}
                                                {item.recipientCount > item.recipientLabels.length ? ` and ${item.recipientCount - item.recipientLabels.length} more` : ""}
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
