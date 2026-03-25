"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import { useTransition } from "react"
import { approveAgent, rejectAgent } from "@/actions/approvals"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface AgentApprovalButtonsProps {
    agentId: string
    status: string
}

export function AgentApprovalButtons({ agentId, status }: AgentApprovalButtonsProps) {
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
            const result = await approveAgent(agentId)
            const error = getError(result)

            if (error) {
                toast({
                    title: "Error",
                    description: error,
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "Success",
                description: "Agent approved successfully",
            })
            router.refresh()
        })
    }

    const handleReject = () => {
        startTransition(async () => {
            const result = await rejectAgent(agentId)
            const error = getError(result)

            if (error) {
                toast({
                    title: "Error",
                    description: error,
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "Success",
                description: "Agent rejected successfully",
            })
            router.refresh()
        })
    }

    if (status !== "pending") return null

    return (
        <div className="flex gap-2">
            <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isPending}
            >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
            </Button>
            <Button
                size="sm"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
            >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
            </Button>
        </div>
    )
}
