"use client"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, FileText, User, Bike } from "lucide-react"
import Image from "next/image"
import { useState, useTransition } from "react"
import { approveRider, rejectRider } from "@/actions/approvals"
import { useToast } from "@/hooks/use-toast"

interface RiderDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    rider: any
}

export function RiderDetailsSheet({ open, onOpenChange, rider }: RiderDetailsSheetProps) {
    const [isPending, startTransition] = useTransition()
    const { toast } = useToast()

    if (!rider) return null

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveRider(rider.id)
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "Success",
                    description: "Rider approved successfully",
                })
                onOpenChange(false)
            }
        })
    }

    const handleReject = () => {
        startTransition(async () => {
            const result = await rejectRider(rider.id)
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "Success",
                    description: "Rider rejected successfully",
                })
                onOpenChange(false)
            }
        })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        Rider Applications
                        <Badge variant={rider.status === "approved" ? "default" : "secondary"}>
                            {rider.status}
                        </Badge>
                    </SheetTitle>
                    <SheetDescription>
                        Review rider documents and details.
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-10rem)] mt-6 pr-4">
                    <div className="space-y-6">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <User className="h-4 w-4" /> Personal Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Name</span>
                                    <p className="text-sm font-medium">{rider.profiles?.full_name || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Phone</span>
                                    <p className="text-sm font-medium">{rider.profiles?.phone || "N/A"}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {rider.passport_photo_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Passport Photo</span>
                                        <div className="relative aspect-square w-24 overflow-hidden rounded-md border">
                                            <Image
                                                src={rider.passport_photo_url}
                                                alt="Passport"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <a href={rider.passport_photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                                {rider.id_card_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">ID Card</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                            <Image
                                                src={rider.id_card_url}
                                                alt="ID Card"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <a href={rider.id_card_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bike Particulars */}
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Bike className="h-4 w-4" /> Bike Particulars
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {rider.bike_particulars?.license_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Bike License</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                            <Image
                                                src={rider.bike_particulars.license_url}
                                                alt="License"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <a href={rider.bike_particulars.license_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                                {rider.bike_particulars?.insurance_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Insurance</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                            <Image
                                                src={rider.bike_particulars.insurance_url}
                                                alt="Insurance"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <a href={rider.bike_particulars.insurance_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                                {rider.bike_particulars?.roadworthiness_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Road Worthiness</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                            <Image
                                                src={rider.bike_particulars.roadworthiness_url}
                                                alt="Road Worthiness"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <a href={rider.bike_particulars.roadworthiness_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Guarantor Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Guarantor Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Name</span>
                                    <p className="text-sm font-medium">{rider.guarantors?.name || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Phone</span>
                                    <p className="text-sm font-medium">{rider.guarantors?.phone || "N/A"}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {rider.guarantors?.id_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Guarantor ID</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                            <Image
                                                src={rider.guarantors.id_url}
                                                alt="Guarantor ID"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <a href={rider.guarantors.id_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                                {rider.guarantors?.form_url && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-muted-foreground">Guarantor Form</span>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                            <Image
                                                src={rider.guarantors.form_url}
                                                alt="Guarantor Form"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <a href={rider.guarantors.form_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block">View Full Size</a>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </ScrollArea>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    {rider.status === "pending" && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={isPending}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </Button>
                            <Button
                                onClick={handleApprove}
                                disabled={isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                            </Button>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
