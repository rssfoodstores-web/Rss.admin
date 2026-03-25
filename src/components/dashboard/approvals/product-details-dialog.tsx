"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle } from "lucide-react"
import { useState } from "react"
import { approveProduct, rejectProduct } from "@/actions/approvals"
import { toast } from "sonner"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface ProductDetailsDialogProps {
    product: any | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProductDetailsDialog({ product, open, onOpenChange }: ProductDetailsDialogProps) {
    const router = useRouter()
    const [reason, setReason] = useState("")
    const [loading, setLoading] = useState(false)

    if (!product) return null

    // Helper to properly display currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
        }).format(amount)
    }

    const handleApprove = async () => {
        setLoading(true)
        try {
            const result = await approveProduct(product.id)
            if (result.error) throw new Error(result.error)
            toast.success("Product approved")
            onOpenChange(false)
            router.refresh()
        } catch (error) {
            toast.error("Failed to approve product")
        } finally {
            setLoading(false)
        }
    }

    const handleReject = async () => {
        setLoading(true)
        try {
            // Note: If you want to save the reason, you'd update your rejectProduct action to accept it.
            // For now passing just ID.
            const result = await rejectProduct(product.id)
            if (result.error) throw new Error(result.error)
            toast.success("Product rejected")
            onOpenChange(false)
            router.refresh()
        } catch (error) {
            toast.error("Failed to reject product")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold border-b pb-4">Product Details</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                    {/* Left Column: Images */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {/* Display up to 4 images. Grid layout like screenshot */}
                            {product.images && product.images.length > 0 ? (
                                product.images.slice(0, 4).map((img: string, i: number) => (
                                    <div key={i} className="aspect-square relative rounded-lg overflow-hidden border bg-muted">
                                        <Image
                                            src={img}
                                            alt={`Product ${i}`}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                ))
                            ) : (
                                // Fallback if no images array, check media_url or placeholder
                                <div className="col-span-2 aspect-square relative rounded-lg overflow-hidden border bg-muted flex items-center justify-center text-muted-foreground">
                                    No Images
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold">{product.name}</h2>
                                <p className="text-sm text-muted-foreground mt-1">SKU: PRO-{product.created_at.slice(0, 4)}-{product.id.slice(0, 4).toUpperCase()}</p>
                            </div>
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-base px-3 py-1">
                                {product.status}
                            </Badge>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                            <div className="flex justify-between py-2 border-b border-muted-foreground/10">
                                <span className="text-muted-foreground">Category</span>
                                <span className="font-medium capitalize">{product.category}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted-foreground/10">
                                <span className="text-muted-foreground">Price</span>
                                <span className="font-medium">{formatCurrency(product.price)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted-foreground/10">
                                <span className="text-muted-foreground">Stock</span>
                                <span className="font-medium">{product.stock_level || 0} units</span>
                            </div>
                            <div className="flex justify-between py-2 text-sm">
                                <span className="text-muted-foreground">Submitted Date</span>
                                <span className="font-medium">{new Date(product.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Description</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {product.description || "No description provided."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-t mt-8 pt-6 space-y-4">
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                            onClick={handleApprove}
                            disabled={loading}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {loading ? "Processing..." : "Accept Product"}
                        </Button>
                        <Button
                            variant="destructive"
                            className="min-w-[140px]"
                            onClick={handleReject}
                            disabled={loading}
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            {loading ? "Processing..." : "Reject"}
                        </Button>
                    </div>

                    <div className="pt-2">
                        <Textarea
                            placeholder="Reason (Optional)"
                            className="resize-none h-24"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
