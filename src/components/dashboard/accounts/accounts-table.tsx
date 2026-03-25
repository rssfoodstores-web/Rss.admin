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
import { ShieldAlert, ShieldCheck, User } from "lucide-react"

interface AccountsTableProps {
    users: any[]
}

export function AccountsTable({ users }: AccountsTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last Updated</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {!users || users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No users found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{user.full_name || "N/A"}</div>
                                    <div className="text-sm text-muted-foreground">{user.company_name}</div>
                                </TableCell>
                                <TableCell>
                                    {user.phone || "N/A"}
                                </TableCell>
                                <TableCell>
                                    <RoleBadge role={user.role} />
                                </TableCell>
                                <TableCell>
                                    {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : "N/A"}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

function RoleBadge({ role }: { role: string }) {
    switch (role) {
        case "supa_admin":
            return (
                <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Super Admin
                </Badge>
            )
        case "sub_admin":
        case "admin":
            return (
                <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500">
                    <ShieldCheck className="h-3 w-3" />
                    {role === "sub_admin" ? "Sub Admin" : "Admin"}
                </Badge>
            )
        case "merchant":
            return (
                <Badge variant="secondary" className="gap-1">
                    Merchant
                </Badge>
            )
        case "rider":
            return (
                <Badge variant="secondary" className="gap-1">
                    Rider
                </Badge>
            )
        default:
            return (
                <Badge variant="outline" className="gap-1">
                    <User className="h-3 w-3" />
                    Customer
                </Badge>
            )
    }
}
