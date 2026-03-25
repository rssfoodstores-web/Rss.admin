import { createClient } from "@/lib/supabase/server"
import { requireAdminRoleAccess } from "@/lib/admin-auth"
import { formatDateTime, labelize, shortId } from "@/lib/admin-display"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Append-only activity trail for pricing, assignments, finance, and admin actions.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Newest entries are shown first.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Metadata</TableHead>
                                    <TableHead className="text-right">Timestamp</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No audit entries have been written yet.
                                        </TableCell>
                                    </TableRow>
                                ) : logs.map((log) => {
                                    const actor = log.actor_id ? profileMap.get(log.actor_id) : null
                                    const metadataPreview = log.metadata
                                        ? JSON.stringify(log.metadata).slice(0, 120)
                                        : "No metadata"

                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="min-w-[180px]">
                                                <div className="font-medium">{actor?.full_name || shortId(log.actor_id)}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {labelize(log.actor_role)}{actor?.phone ? ` • ${actor.phone}` : ""}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{labelize(log.action)}</Badge>
                                            </TableCell>
                                            <TableCell className="min-w-[160px]">
                                                <div className="font-medium">{labelize(log.entity_type)}</div>
                                                <div className="text-sm text-muted-foreground">{shortId(log.entity_id, 10)}</div>
                                            </TableCell>
                                            <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                                                {metadataPreview}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatDateTime(log.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
