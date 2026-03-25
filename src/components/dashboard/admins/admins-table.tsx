"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldAlert, ShieldCheck } from "lucide-react"

interface AdminsTableProps {
    admins: any[]
}

export function AdminsTable({ admins }: AdminsTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {!admins || admins.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No admins found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        admins.map((admin) => (
                            <TableRow key={admin.id}>
                                <TableCell>
                                    <div className="font-medium">{admin.full_name || "N/A"}</div>
                                    <div className="text-sm text-muted-foreground">{admin.company_name}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={admin.role === "supa_admin" ? "destructive" : "outline"} className="gap-1">
                                        {admin.role === "supa_admin" ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                        {admin.role === "supa_admin" ? "Super Admin" : "Sub Admin"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                        Active
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">Edit</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
