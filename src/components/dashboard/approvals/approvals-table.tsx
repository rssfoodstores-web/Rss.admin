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
import { useState } from "react"
import { ProductDetailsDialog } from "./product-details-dialog"

interface ApprovalsTableProps {
    products: any[]
}

export function ApprovalsTable({ products }: ApprovalsTableProps) {
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

    // Helper to format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
        }).format(amount)
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!products || products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No pending approvals found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((item) => (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => setSelectedProduct(item)}
                                >
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="capitalize">{item.category}</TableCell>
                                    <TableCell>{formatCurrency(item.price)}</TableCell>
                                    <TableCell>
                                        {item.profiles?.company_name || item.profiles?.full_name || "Unknown"}
                                    </TableCell>
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
                                                setSelectedProduct(item)
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

            <ProductDetailsDialog
                open={!!selectedProduct}
                onOpenChange={(open) => !open && setSelectedProduct(null)}
                product={selectedProduct}
            />
        </>
    )
}
