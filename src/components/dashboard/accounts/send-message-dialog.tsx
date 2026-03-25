"use client"

import { useState, useEffect } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { sendUserMessage } from "@/actions/notifications"
import { Loader2, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SendMessageDialogProps {
    user: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

const initialState = {
    message: null,
    errors: {}
}

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Sending..." : "Send Message"}
        </Button>
    )
}

export function SendMessageDialog({ user, open, onOpenChange }: SendMessageDialogProps) {
    const [state, formAction] = useFormState(sendUserMessage, initialState)
    const { toast } = useToast()

    // Close dialog on success
    useEffect(() => {
        if (state.message === "success") {
            onOpenChange(false)
            toast({
                title: "Message Sent",
                description: `Successfully sent message to ${user?.full_name || "User"}.`,
                variant: "default", // Success variant usually default or we can add success
            })
            // Reset state (hacky way since useFormState doesn't expose reset)
        } else if (state.message && state.message !== "success") {
            toast({
                title: "Error",
                description: state.message,
                variant: "destructive",
            })
        }
    }, [state.message, onOpenChange, toast, user])

    if (!user) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Message</DialogTitle>
                    <DialogDescription>
                        Send a direct notification to <span className="font-medium text-foreground">{user.full_name || "User"}</span>.
                        They will receive this in their notifications center.
                    </DialogDescription>
                </DialogHeader>
                <form action={formAction} className="grid gap-4 py-4">
                    <input type="hidden" name="userId" value={user.id} />

                    <div className="grid gap-2">
                        <Label htmlFor="title">Subject</Label>
                        <Input
                            id="title"
                            name="title"
                            placeholder="e.g., Account Update"
                            required
                        />
                        {state.errors?.title && (
                            <p className="text-sm text-red-500">{state.errors.title[0]}</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                            id="message"
                            name="message"
                            placeholder="Type your message here..."
                            className="min-h-[100px]"
                            required
                        />
                        {state.errors?.message && (
                            <p className="text-sm text-red-500">{state.errors.message[0]}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
