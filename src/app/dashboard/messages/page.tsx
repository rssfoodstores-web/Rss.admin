import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { formatDateTime, labelize, shortId } from "@/lib/admin-display"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ContactConversationRow {
    created_at: string
    escalated_to_human: boolean
    id: string
    last_message_at: string
    last_message_preview: string | null
    resolved_by_ai: boolean
    status: string
    subject: string | null
    updated_at: string
    user_id: string | null
    visitor_email: string
    visitor_name: string
    visitor_phone: string | null
}

interface SupportMessageRow {
    body: string
    conversation_id: string
    created_at: string
    id: string
    sender_role: string
}

interface ProfileRow {
    company_name: string | null
    full_name: string | null
    id: string
    phone: string | null
}

function getStatusTone(status: string | null | undefined) {
    switch (status) {
        case "resolved":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        case "human_follow_up":
        case "open":
            return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    }
}

export default async function MessagesPage() {
    const access = await requireAdminRouteAccess("messages")
    const supabase = access.supabase

    const conversationResult = await supabase
        .from("support_conversations")
        .select("id, user_id, visitor_name, visitor_email, visitor_phone, subject, status, resolved_by_ai, escalated_to_human, last_message_at, last_message_preview, created_at, updated_at")
        .eq("subject", "Contact form submission")
        .order("last_message_at", { ascending: false })
        .limit(80)

    if (conversationResult.error) {
        throw new Error(conversationResult.error.message)
    }

    const conversations = (conversationResult.data ?? []) as ContactConversationRow[]
    const conversationIds = conversations.map((conversation) => conversation.id)
    const linkedUserIds = Array.from(new Set(conversations.map((conversation) => conversation.user_id).filter((value): value is string => Boolean(value))))

    const [messageResult, profileResult] = await Promise.all([
        conversationIds.length > 0
            ? supabase
                .from("support_messages")
                .select("id, conversation_id, sender_role, body, created_at")
                .in("conversation_id", conversationIds)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] as SupportMessageRow[], error: null }),
        linkedUserIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name, company_name, phone")
                .in("id", linkedUserIds)
            : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    ])

    if (messageResult.error) {
        throw new Error(messageResult.error.message)
    }

    if (profileResult.error) {
        throw new Error(profileResult.error.message)
    }

    const messages = (messageResult.data ?? []) as SupportMessageRow[]
    const profiles = (profileResult.data ?? []) as ProfileRow[]

    const profileMap = new Map(
        profiles.map((profile) => [
            profile.id,
            profile.full_name?.trim() || profile.company_name?.trim() || profile.phone?.trim() || shortId(profile.id, 10),
        ])
    )

    const messageMap = messages.reduce<Map<string, SupportMessageRow[]>>((acc, message) => {
        const existing = acc.get(message.conversation_id) ?? []
        existing.push(message)
        acc.set(message.conversation_id, existing)
        return acc
    }, new Map())

    const openCount = conversations.filter((conversation) => conversation.status === "open" || conversation.status === "human_follow_up").length
    const linkedCount = conversations.filter((conversation) => conversation.user_id).length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Messages</h1>
                <p className="mt-1 text-muted-foreground">
                    Contact-form submissions from the storefront. Admins can now see who sent the message and what they wrote.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Inbox</div>
                        <div className="mt-3 text-3xl font-bold text-foreground">{conversations.length}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Contact-form conversations loaded.</div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Open</div>
                        <div className="mt-3 text-3xl font-bold text-foreground">{openCount}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Still awaiting a close-out or human follow-up.</div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Linked accounts</div>
                        <div className="mt-3 text-3xl font-bold text-foreground">{linkedCount}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Messages sent while the customer was signed in.</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
                <CardHeader>
                    <CardTitle>Contact inbox</CardTitle>
                    <CardDescription>Every submission created from the public contact form appears here.</CardDescription>
                </CardHeader>
                <CardContent>
                    {conversations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
                            No contact-form messages have been submitted yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {conversations.map((conversation) => {
                                const threadMessages = messageMap.get(conversation.id) ?? []
                                const firstCustomerMessage = threadMessages.find((message) => message.sender_role === "customer")
                                const latestReply = [...threadMessages].reverse().find((message) => message.sender_role !== "customer")
                                const linkedUserLabel = conversation.user_id ? profileMap.get(conversation.user_id) ?? shortId(conversation.user_id, 10) : null

                                return (
                                    <div key={conversation.id} className="rounded-2xl border border-border/60 p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-semibold text-foreground">{conversation.visitor_name}</div>
                                                    <Badge variant="outline" className={cn(getStatusTone(conversation.status))}>
                                                        {labelize(conversation.status)}
                                                    </Badge>
                                                    {conversation.resolved_by_ai ? <Badge variant="outline">AI resolved</Badge> : null}
                                                    {conversation.escalated_to_human ? <Badge variant="outline">Human follow-up</Badge> : null}
                                                </div>

                                                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                                                    <div>Email: {conversation.visitor_email}</div>
                                                    <div>Phone: {conversation.visitor_phone || "Not provided"}</div>
                                                    <div>Linked account: {linkedUserLabel || "Guest / unsigned visitor"}</div>
                                                    <div>Conversation: {shortId(conversation.id, 12)}</div>
                                                </div>

                                                <div className="rounded-2xl bg-muted/30 p-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Submitted message</div>
                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                                        {firstCustomerMessage?.body || conversation.last_message_preview || "No message body captured."}
                                                    </p>
                                                </div>

                                                {latestReply ? (
                                                    <div className="rounded-2xl border border-border/60 p-4">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest reply</div>
                                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{latestReply.body}</p>
                                                        <p className="mt-2 text-xs text-muted-foreground">
                                                            {labelize(latestReply.sender_role)} · {formatDateTime(latestReply.created_at)}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="min-w-[180px] space-y-2 text-sm text-muted-foreground lg:text-right">
                                                <div>Received {formatDateTime(conversation.created_at)}</div>
                                                <div>Last activity {formatDateTime(conversation.last_message_at)}</div>
                                                <div>{threadMessages.length} message{threadMessages.length === 1 ? "" : "s"} in thread</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
