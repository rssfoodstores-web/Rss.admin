"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Search, Send, Users, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { sendUserMessage } from "@/actions/notifications"
import type { NotificationHistoryItem } from "@/lib/admin-notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface RecipientSearchResult {
    company_name: string | null
    full_name: string | null
    id: string
    phone: string | null
}

interface NotificationsPageClientProps {
    initialHistory: NotificationHistoryItem[]
    totalRecipients: number
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

function getRecipientLabel(user: RecipientSearchResult | null) {
    if (!user) {
        return "Selected user"
    }

    return user.full_name?.trim()
        || user.company_name?.trim()
        || user.phone?.trim()
        || user.id.slice(0, 8)
}

export function NotificationsPageClient({ initialHistory, totalRecipients }: NotificationsPageClientProps) {
    const searchParams = useSearchParams()
    const urlUserId = searchParams.get("userId")
    const { toast } = useToast()
    const [supabase] = useState(() => createClient())
    const [history, setHistory] = useState(initialHistory)
    const [loading, setLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [audience, setAudience] = useState<"single" | "all">("single")
    const [selectedUser, setSelectedUser] = useState<RecipientSearchResult | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<RecipientSearchResult[]>([])
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")
    const [actionUrl, setActionUrl] = useState("")

    useEffect(() => {
        if (!urlUserId) {
            return
        }

        let active = true

        async function loadUser() {
            setSearchLoading(true)
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .eq("id", urlUserId)
                .maybeSingle()

            if (!active) {
                return
            }

            if (error) {
                toast({
                    title: "Lookup failed",
                    description: error.message,
                    variant: "destructive",
                })
            } else if (data) {
                setAudience("single")
                setSelectedUser(data)
            }

            setSearchLoading(false)
        }

        void loadUser()

        return () => {
            active = false
        }
    }, [supabase, toast, urlUserId])

    const audienceSummary = useMemo(() => {
        if (audience === "all") {
            return `Broadcast to all ${totalRecipients.toLocaleString()} account${totalRecipients === 1 ? "" : "s"}`
        }

        return selectedUser ? `Direct notification to ${getRecipientLabel(selectedUser)}` : "Choose one user"
    }, [audience, selectedUser, totalRecipients])

    async function handleSearch(event: React.FormEvent) {
        event.preventDefault()
        const query = searchQuery.trim()

        if (!query) {
            setSearchResults([])
            return
        }

        setSearchLoading(true)

        const sanitizedQuery = query.replace(/[%_,]/g, " ")
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, company_name, phone")
            .or(`full_name.ilike.%${sanitizedQuery}%,company_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
            .order("updated_at", { ascending: false })
            .limit(8)

        if (error) {
            toast({
                title: "Search failed",
                description: error.message,
                variant: "destructive",
            })
            setSearchResults([])
        } else {
            setSearchResults((data ?? []) as RecipientSearchResult[])
        }

        setSearchLoading(false)
    }

    async function handleSend(event: React.FormEvent) {
        event.preventDefault()

        if (audience === "single" && !selectedUser) {
            toast({
                title: "Recipient required",
                description: "Select a user before sending.",
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
        formData.append("title", title)
        formData.append("message", message)
        formData.append("action_url", actionUrl)

        const result = await sendUserMessage({}, formData)

        if (result.message === "success") {
            toast({
                title: "Notification sent",
                description: audience === "all"
                    ? `Broadcast delivered to ${result.sentCount ?? totalRecipients} users.`
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
                setSearchResults([])
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
                <p className="text-muted-foreground">Send direct notifications to one user or broadcast an announcement to every account.</p>
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
                        <div className="mt-3 text-3xl font-bold">{audience === "all" ? "Broadcast" : "Direct"}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{audienceSummary}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Audience</CardTitle>
                        <CardDescription>Choose a single recipient or notify everybody at once.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setAudience("single")}
                                className={`rounded-2xl border p-4 text-left transition ${audience === "single" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                            >
                                <div className="flex items-center gap-2 font-semibold">
                                    <UserRound className="h-4 w-4" />
                                    Specific user
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">Search by name, company, or phone and send one message.</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAudience("all")
                                    setSelectedUser(null)
                                    setSearchResults([])
                                    setSearchQuery("")
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
                                <form onSubmit={handleSearch} className="flex gap-2">
                                    <Input
                                        placeholder="Search by name, phone, or company..."
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                    />
                                    <Button type="submit" variant="secondary" disabled={searchLoading}>
                                        {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </form>

                                {searchResults.length > 0 && !selectedUser ? (
                                    <div className="max-h-[260px] divide-y overflow-y-auto rounded-2xl border">
                                        {searchResults.map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted"
                                                onClick={() => {
                                                    setSelectedUser(user)
                                                    setSearchQuery("")
                                                    setSearchResults([])
                                                }}
                                            >
                                                <div>
                                                    <div className="font-medium">{getRecipientLabel(user)}</div>
                                                    <div className="text-sm text-muted-foreground">{user.phone || user.company_name || user.id}</div>
                                                </div>
                                                <Badge variant="outline">Select</Badge>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}

                                {selectedUser ? (
                                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                                        <div className="mb-2 flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">{getRecipientLabel(selectedUser)}</div>
                                                <div className="text-sm text-muted-foreground">{selectedUser.phone || selectedUser.company_name || selectedUser.id}</div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-auto px-2 py-1" onClick={() => setSelectedUser(null)}>
                                                Change
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground">Recipient ID {selectedUser.id}</div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                                        {searchLoading ? "Looking up user..." : "No user selected yet."}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-muted-foreground dark:border-orange-900 dark:bg-orange-950/20">
                                This will broadcast the same notification to all {totalRecipients.toLocaleString()} profiles currently stored in the system.
                            </div>
                        )}
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
                            <Button type="submit" className="w-full bg-orange-500 text-white hover:bg-orange-600" disabled={loading || (audience === "single" && !selectedUser)}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {audience === "all" ? "Broadcast notification" : "Send notification"}
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
                                                <Badge variant="outline">{item.audience === "all" ? "Broadcast" : "Direct"}</Badge>
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
