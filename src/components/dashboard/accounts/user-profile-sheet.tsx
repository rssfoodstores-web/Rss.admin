"use client"

import Link from "next/link"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    Mail,
    Phone,
    MapPin,
    Calendar,
    Building2,
    ShieldAlert,
    ShieldCheck,
    User,
    CreditCard,
    Copy,
    MessageSquare,
    Lock
} from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface UserProfileSheetProps {
    user: any | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function UserProfileSheet({ user, open, onOpenChange }: UserProfileSheetProps) {
    const { toast } = useToast()

    if (!user) return null

    const initials = user.full_name
        ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
        : 'U'

    const copyId = () => {
        navigator.clipboard.writeText(user.id)
        toast({
            title: "Copied",
            description: "User ID copied to clipboard",
        })
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="sm:max-w-md overflow-y-auto">
                    <SheetHeader className="absolute left-6 top-6">
                        {/* Empty header for accessibility if needed, or simple title */}
                        <SheetTitle className="sr-only">User Profile</SheetTitle>
                    </SheetHeader>

                    <div className="flex flex-col items-center gap-4 mt-8 pb-6 border-b">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                            <h2 className="text-xl font-bold">{user.full_name || "Unknown User"}</h2>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <RoleBadge role={user.role} />
                                {user.location_locked && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Lock className="h-3 w-3" />
                                        Locked
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full mt-2">
                            <Link href={`/dashboard/notifications?userId=${user.id}`} className="flex-1">
                                <Button className="w-full">
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Message
                                </Button>
                            </Link>
                            <Button variant="outline" size="icon" onClick={copyId} title="Copy User ID">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="py-6 space-y-6">
                        {/* Contact Info */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact Information</h3>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                    <Mail className="h-4 w-4 opacity-70" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">Email</p>
                                    <p className="text-muted-foreground">{user.email || "Not available via API"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                    <Phone className="h-4 w-4 opacity-70" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">Phone</p>
                                    <p className="text-muted-foreground">{user.phone || "N/A"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                    <MapPin className="h-4 w-4 opacity-70" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">Address</p>
                                    <p className="text-muted-foreground">
                                        {[user.street_address, user.house_number, user.state, user.zip_code].filter(Boolean).join(", ") || "N/A"}
                                    </p>
                                </div>
                            </div>

                            {user.company_name && (
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                        <Building2 className="h-4 w-4 opacity-70" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">Company</p>
                                        <p className="text-muted-foreground">{user.company_name}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Account Stats */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Account Details</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg border bg-muted/20">
                                    <div className="text-muted-foreground text-xs mb-1">Points Balance</div>
                                    <div className="text-lg font-bold flex items-center gap-2">
                                        {user.points_balance || 0}
                                        <span className="text-xs font-normal text-muted-foreground">pts</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20">
                                    <div className="text-muted-foreground text-xs mb-1">Referral Code</div>
                                    <div className="text-lg font-bold">{user.referral_code || "N/A"}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm pt-2">
                                <Calendar className="h-4 w-4 opacity-70" />
                                <span className="text-muted-foreground">Joined: {new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}

function RoleBadge({ role }: { role: string }) {
    switch (role) {
        case "supa_admin":
            return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Super Admin</Badge>
        case "sub_admin":
        case "admin":
            return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
        case "merchant":
            return <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">Merchant</Badge>
        case "rider":
            return <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Rider</Badge>
        default:
            return <Badge variant="outline" className="gap-1"><User className="h-3 w-3" /> Customer</Badge>
    }
}
