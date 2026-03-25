"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { approveProductPricing, rejectProductPricing } from "@/actions/approvals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { getActionError } from "@/lib/action-result"
import { formatKobo, nairaToKobo } from "@/lib/money"

interface PricingApprovalControlsProps {
    productId: string
    defaultApprovedPriceNaira: number
    defaultInsuranceNaira: number
    merchantInputKobo: number | null
    agentFeeBps: number
    appFeeBps: number
    opsFeeBps: number
    vatBps: number
}

function basisPointsToAmount(amountKobo: number, basisPoints: number) {
    return Math.round((amountKobo * basisPoints) / 10_000)
}

export function PricingApprovalControls({
    productId,
    defaultApprovedPriceNaira,
    defaultInsuranceNaira,
    merchantInputKobo,
    agentFeeBps,
    appFeeBps,
    opsFeeBps,
    vatBps,
}: PricingApprovalControlsProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [approvedPriceNaira, setApprovedPriceNaira] = useState(String(defaultApprovedPriceNaira))
    const [insuranceNaira, setInsuranceNaira] = useState(String(defaultInsuranceNaira))
    const [isPending, startTransition] = useTransition()

    const approvedPriceKobo = nairaToKobo(Number(approvedPriceNaira || 0))
    const hasInvalidMerchantBase = (merchantInputKobo ?? 0) <= 0

    const handleApprove = () => {
        startTransition(async () => {
            const formData = new FormData()
            formData.set("product_id", productId)
            formData.set("approved_price_naira", approvedPriceNaira)
            formData.set("insurance_naira", insuranceNaira)

            const result = await approveProductPricing(formData)
            const error = getActionError(result)

            if (error) {
                toast({
                    title: "Approval failed",
                    description: error,
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "Pricing approved",
                description: "The product is now visible on the storefront with the final approved price.",
            })
            router.refresh()
        })
    }

    const handleReject = () => {
        if (!window.confirm("Are you sure you want to reject this product pricing request?")) {
            return
        }

        startTransition(async () => {
            const formData = new FormData()
            formData.set("product_id", productId)

            const result = await rejectProductPricing(formData)
            const error = getActionError(result)

            if (error) {
                toast({
                    title: "Rejection failed",
                    description: error,
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "Product rejected",
                description: "The merchant will need to resubmit this product for pricing review.",
            })
            router.refresh()
        })
    }

    return (
        <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Approved Price (NGN)</label>
                    <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={approvedPriceNaira}
                        onChange={(event) => setApprovedPriceNaira(event.target.value)}
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Insurance (NGN)</label>
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={insuranceNaira}
                        onChange={(event) => setInsuranceNaira(event.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                Preview: Agent {formatKobo(basisPointsToAmount(approvedPriceKobo, agentFeeBps))} • App {formatKobo(basisPointsToAmount(approvedPriceKobo, appFeeBps))} • Ops {formatKobo(basisPointsToAmount(approvedPriceKobo, opsFeeBps))} • VAT {formatKobo(basisPointsToAmount(approvedPriceKobo, vatBps))}
            </div>

            {hasInvalidMerchantBase && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                    Merchant base price is invalid. The merchant must edit this product and enter a base price greater than ₦0.00 before approval.
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    type="button"
                    onClick={handleApprove}
                    disabled={isPending}
                    className="bg-orange-500 hover:bg-orange-600"
                >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Approve Pricing
                </Button>
                <Button
                    type="button"
                    onClick={handleReject}
                    disabled={isPending}
                    variant="outline"
                >
                    Reject
                </Button>
            </div>
        </div>
    )
}
