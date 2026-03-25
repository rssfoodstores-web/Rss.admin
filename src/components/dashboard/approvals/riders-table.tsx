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
import { Eye } from "lucide-react"
import { useRouter } from "next/navigation"

interface RidersTableProps {
    riders: any[]
}

export function RidersTable({ riders }: RidersTableProps) {
    const router = useRouter()

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Rider Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Date Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {!riders || riders.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No pending rider applications.
                            </TableCell>
                        </TableRow>
                    ) : (
                        riders.map((item) => (
                            <TableRow
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => router.push(`/dashboard/users/${item.id}`)}
                            >
                                <TableCell className="font-medium">{item.profiles?.full_name || "Unknown"}</TableCell>
                                <TableCell>{item.profiles?.phone || "N/A"}</TableCell>
                                <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            router.push(`/dashboard/users/${item.id}`)
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
