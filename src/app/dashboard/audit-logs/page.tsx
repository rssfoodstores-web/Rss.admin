import { createClient } from "@/lib/supabase/server"
import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { formatDateTime, labelize, shortId } from "@/lib/admin-display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Activity,
    Clock,
    FileText,
    Shield,
    UserCheck,
    Plus,
    Trash2,
    Pencil,
    DollarSign,
    Ban,
    Settings,
    Eye,
    HelpCircle,
    Info,
    BookOpen,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

type AuditRow = {
    id: string
    actor_id: string | null
    actor_role: string | null
    action: string
    entity_type: string
    entity_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
}

type ProfileRow = {
    id: string
    full_name: string | null
    phone: string | null
    company_name: string | null
}

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
}

function getActionStyle(action: string) {
    const lower = action.toLowerCase()

    if (lower.includes("create") || lower.includes("approve") || lower.includes("grant") || lower.includes("add")) {
        return {
            className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
            icon: Plus,
            dotColor: "bg-emerald-500",
        }
    }

    if (lower.includes("delete") || lower.includes("remove") || lower.includes("reject") || lower.includes("revoke")) {
        return {
            className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
            icon: Trash2,
            dotColor: "bg-red-500",
        }
    }

    if (lower.includes("update") || lower.includes("edit") || lower.includes("modify") || lower.includes("change")) {
        return {
            className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
            icon: Pencil,
            dotColor: "bg-blue-500",
        }
    }

    if (lower.includes("login") || lower.includes("auth") || lower.includes("access") || lower.includes("role")) {
        return {
            className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
            icon: Shield,
            dotColor: "bg-violet-500",
        }
    }

    if (lower.includes("pay") || lower.includes("settle") || lower.includes("finance") || lower.includes("price")) {
        return {
            className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
            icon: DollarSign,
            dotColor: "bg-amber-500",
        }
    }

    return {
        className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
        icon: Settings,
        dotColor: "bg-slate-400",
    }
}

function getRoleBadge(role: string | null) {
    if (!role) return null

    const lower = role.toLowerCase()

    if (lower === "supa_admin") {
        return (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 leading-4">
                Super Admin
            </Badge>
        )
    }

    if (lower === "admin") {
        return (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400">
                Admin
            </Badge>
        )
    }

    return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-4">
            {labelize(role)}
        </Badge>
    )
}

function relativeTime(dateStr: string) {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = now - then

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    return formatDateTime(dateStr)
}

function MetadataDisplay({ metadata }: { metadata: Record<string, unknown> | null }) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return <span className="text-muted-foreground/50 italic text-xs">No metadata</span>
    }

    const entries = Object.entries(metadata).slice(0, 4)
    const remaining = Object.keys(metadata).length - entries.length

    return (
        <div className="flex flex-wrap gap-1">
            {entries.map(([key, value]) => (
                <TooltipProvider key={key} delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono cursor-default max-w-[140px] truncate">
                                <span className="text-muted-foreground font-medium">{key}:</span>
                                <span className="truncate">{String(value)}</span>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                            <p className="font-mono text-xs break-all">{key}: {JSON.stringify(value)}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}
            {remaining > 0 && (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground cursor-default">
                                +{remaining} more
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                            <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                                {JSON.stringify(metadata, null, 2)}
                            </pre>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

export default async function AuditLogsPage() {
    await requireAdminRoleAccess(["supa_admin"], "audit_logs")
    const supabase = await createClient()
    const { data: logsData } = await supabase
        .from("audit_logs")
        .select("id, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100)

    const logs = (logsData ?? []) as AuditRow[]
    const actorIds = Array.from(new Set(logs.map((log) => log.actor_id).filter(Boolean) as string[]))
    const { data: profilesData } = actorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, phone, company_name")
            .in("id", actorIds)
        : { data: [] }

    const profiles = (profilesData ?? []) as ProfileRow[]
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

    /* ── stats ── */
    const uniqueActors = new Set(logs.map((l) => l.actor_id).filter(Boolean)).size
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = logs.filter((l) => new Date(l.created_at) >= todayStart).length
    const entityTypes = new Set(logs.map((l) => l.entity_type)).size

    return (
        <div className="flex flex-col gap-6">
            {/* ── page header ── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
                        <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                        <p className="text-muted-foreground text-sm">
                            Append-only activity trail for pricing, assignments, finance, and admin actions.
                        </p>
                    </div>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 border-orange-200 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950/20">
                            <HelpCircle className="h-4 w-4 text-orange-500" />
                            Guide & Terminology
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-orange-500" />
                                Understanding Audit Logs
                            </DialogTitle>
                            <DialogDescription>
                                A quick guide to interpreting the activity history on this dashboard.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 pt-4">
                            <section className="space-y-3">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-orange-500" />
                                    1. The Actor
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    The "Actor" is the person or system that triggered the event. This is usually an admin or sub-admin. If you see <code className="bg-muted px-1 rounded text-orange-600">System</code>, it means an automated task or background process performed the action (e.g., an automatic settlement).
                                </p>
                            </section>

                            <Separator />

                            <section className="space-y-3">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-emerald-500" />
                                    2. Action Types
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Create / Approve</p>
                                        <p className="text-xs text-muted-foreground mt-1">Adding new data or granting access.</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Update / Edit</p>
                                        <p className="text-xs text-muted-foreground mt-1">Changing existing information (e.g., price changes).</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Delete / Reject</p>
                                        <p className="text-xs text-muted-foreground mt-1">Removing data or revoking access.</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Financial</p>
                                        <p className="text-xs text-muted-foreground mt-1">Payments, settlements, and commission updates.</p>
                                    </div>
                                </div>
                            </section>

                            <Separator />

                            <section className="space-y-3">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <Info className="h-4 w-4 text-blue-500" />
                                    3. Metadata & Details
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    This contains the "behind-the-scenes" data for every action. Move your mouse over the small chips to see more info.
                                </p>
                                <ul className="space-y-2 list-disc pl-5 text-sm text-muted-foreground">
                                    <li>
                                        <strong className="text-foreground">order_no:</strong> The unique reference for a customer order. Use this to find the specific order in the Orders dashboard.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">old_value / new_value:</strong> Frequently used for price logs showing what was changed.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">granted_pages:</strong> Lists exactly which permissions were given to a sub-admin.
                                    </li>
                                </ul>
                            </section>

                            <section className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 dark:border-orange-900/30 dark:bg-orange-950/20">
                                <p className="text-xs leading-relaxed text-orange-800 dark:text-orange-300">
                                    <strong>Tip:</strong> These logs are append-only. They cannot be edited or deleted, ensuring a permanent and tamper-proof history of all critical admin operations.
                                </p>
                            </section>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ── stat cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                            <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Entries</p>
                            <p className="text-2xl font-bold">{logs.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Today</p>
                            <p className="text-2xl font-bold">{todayCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/10">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                            <UserCheck className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Unique Actors</p>
                            <p className="text-2xl font-bold">{uniqueActors}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                            <Eye className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Entity Types</p>
                            <p className="text-2xl font-bold">{entityTypes}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── timeline ── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-orange-500" />
                                Recent Activity
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Showing the last {logs.length} entries, newest first.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1.5 border-orange-200 text-orange-600 dark:border-orange-800 dark:text-orange-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                            Live
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                <FileText className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <p className="font-medium text-muted-foreground">No audit entries yet</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">
                                Activity will appear here once admin actions are performed.
                            </p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-orange-300 via-border to-transparent dark:from-orange-800" />

                            <div className="space-y-1">
                                {logs.map((log, index) => {
                                    const actor = log.actor_id ? profileMap.get(log.actor_id) : null
                                    const actionStyle = getActionStyle(log.action)
                                    const ActionIcon = actionStyle.icon
                                    const actorName = actor?.full_name || "System"

                                    return (
                                        <div
                                            key={log.id}
                                            className="group relative flex gap-4 rounded-xl p-3 transition-colors hover:bg-muted/40"
                                        >
                                            {/* Timeline dot */}
                                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                                                <div className={`absolute h-2.5 w-2.5 rounded-full ${actionStyle.dotColor} ring-4 ring-background`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                    {/* Left: actor + action */}
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <Avatar className="h-8 w-8 shrink-0 border">
                                                            <AvatarFallback className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                                                                {getInitials(actorName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="font-semibold text-sm truncate">{actorName}</span>
                                                                {getRoleBadge(log.actor_role)}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline" className={`gap-1 text-xs ${actionStyle.className}`}>
                                                                    <ActionIcon className="h-3 w-3" />
                                                                    {labelize(log.action)}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    on <span className="font-medium text-foreground/80">{labelize(log.entity_type)}</span>
                                                                </span>
                                                                {log.entity_id && (
                                                                    <TooltipProvider delayDuration={200}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground cursor-default">
                                                                                    {shortId(log.entity_id, 10)}
                                                                                </code>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p className="font-mono text-xs">{log.entity_id}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </div>
                                                            {/* Metadata */}
                                                            <div className="pt-0.5">
                                                                <MetadataDisplay metadata={log.metadata} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: timestamp */}
                                                    <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-default flex items-center gap-1.5">
                                                                    <Clock className="h-3 w-3" />
                                                                    {relativeTime(log.created_at)}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">
                                                                <p className="text-xs">{formatDateTime(log.created_at)}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>

                                                {index < logs.length - 1 && (
                                                    <Separator className="mt-3 opacity-50" />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
