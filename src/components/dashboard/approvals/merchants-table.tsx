"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Building2, Phone, Calendar, User } from "lucide-react"
import { approveMerchant, rejectMerchant } from "@/actions/approvals"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface MerchantsTableProps {
    merchants: any[]
}

export function MerchantsTable({ merchants }: MerchantsTableProps) {
    const { toast } = useToast()
    const [processingId, setProcessingId] = useState<string | null>(null)

    const getError = (result: unknown) => {
        if (typeof result === "object" && result !== null && "error" in result) {
            const error = result.error
            return typeof error === "string" ? error : null
        }

        return null
    }

    const handleApprove = async (id: string) => {
        setProcessingId(id)
        try {
            const result = await approveMerchant(id)
            const error = getError(result)

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error
                })
            } else {
                toast({
                    title: "Success",
                    description: "Merchant approved successfully"
                })
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to approve merchant"
            })
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm("Are you sure you want to reject this merchant account?")) return

        setProcessingId(id)
        try {
            const result = await rejectMerchant(id)
            const error = getError(result)

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error
                })
            } else {
                toast({
                    title: "Success",
                    description: "Merchant rejected successfully"
                })
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to reject merchant"
            })
        } finally {
            setProcessingId(null)
        }
    }

    if (!merchants || merchants.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-md min-h-[200px] bg-muted/10">
                <Building2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No Pending Merchants</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    There are no new merchant account requests pending approval at this time.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Contact Info</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {merchants.map((merchant) => (
                        <TableRow key={merchant.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={merchant.avatar_url} alt={merchant.full_name || ""} />
                                        <AvatarFallback>
                                            <User className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{merchant.company_name || merchant.full_name}</span>
                                        {merchant.company_name && (
                                            <span className="text-xs text-muted-foreground">{merchant.full_name}</span>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    {merchant.phone && (
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Phone className="mr-2 h-3 w-3" />
                                            {merchant.phone}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                    {merchant.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Calendar className="mr-2 h-3 w-3" />
                                    {new Date(merchant.created_at).toLocaleDateString()}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => handleApprove(merchant.id)}
                                        disabled={processingId === merchant.id}
                                    >
                                        <Check className="h-4 w-4" />
                                        <span className="sr-only">Approve</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleReject(merchant.id)}
                                        disabled={processingId === merchant.id}
                                    >
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Reject</span>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
