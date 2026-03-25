"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import { useTransition } from "react"
import { approveRider, rejectRider } from "@/actions/approvals"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface RiderApprovalButtonsProps {
    riderId: string
    status: string
}

export function RiderApprovalButtons({ riderId, status }: RiderApprovalButtonsProps) {
    const [isPending, startTransition] = useTransition()
    const { toast } = useToast()
    const router = useRouter()

    const getError = (result: unknown) => {
        if (typeof result === "object" && result !== null && "error" in result) {
            const error = result.error
            return typeof error === "string" ? error : null
        }

        return null
    }

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveRider(riderId)
            const error = getError(result)

            if (error) {
                toast({
                    title: "Error",
                    description: error,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "Success",
                    description: "Rider approved successfully",
                })
                router.refresh()
            }
        })
    }

    const handleReject = () => {
        startTransition(async () => {
            const result = await rejectRider(riderId)
            const error = getError(result)

            if (error) {
                toast({
                    title: "Error",
                    description: error,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "Success",
                    description: "Rider rejected successfully",
                })
                router.refresh()
            }
        })
    }

    if (status !== 'pending') return null

    return (
        <div className="flex gap-2">
            <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isPending}
            >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
            </Button>
            <Button
                size="sm"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
            >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
            </Button>
        </div>
    )
}
