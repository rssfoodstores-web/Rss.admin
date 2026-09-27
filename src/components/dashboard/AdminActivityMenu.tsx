"use client"

import Link from "next/link"
import { Bell, Bike, Headphones, MapPin, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminActivitySnapshot } from "@/lib/admin-activity"

function relativeTime(value: string | null) {
    if (!value) return "Waiting for action"
    const elapsed = Date.now() - Date.parse(value)
    const minutes = Math.max(0, Math.floor(elapsed / 60_000))
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export function AdminActivityMenu({ activity, loading }: { activity: AdminActivitySnapshot; loading: boolean }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={`${activity.total} dashboard items need attention`}>
                    <Bell className="h-5 w-5" />
                    {activity.total > 0 ? (
                        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                            {activity.total > 99 ? "99+" : activity.total}
                        </span>
                    ) : null}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <div>
                        <DropdownMenuLabel className="p-0 text-base">Needs attention</DropdownMenuLabel>
                        <p className="text-xs text-muted-foreground">Live work across the admin dashboard</p>
                    </div>
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-[26rem] overflow-y-auto p-2">
                    {activity.items.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                            <p className="mt-3 font-medium">Nothing needs attention</p>
                            <p className="mt-1 text-xs text-muted-foreground">New approvals and operational requests will appear here.</p>
                        </div>
                    ) : activity.items.map((item) => {
                        const Icon = item.kind === "approval" ? Bike : item.kind === "location" ? MapPin : Headphones
                        return (
                            <Link key={item.id} href={item.href} className="flex gap-3 rounded-lg px-3 py-3 hover:bg-muted focus:bg-muted focus:outline-none">
                                <span className="mt-0.5 rounded-full bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/40"><Icon className="h-4 w-4" /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{item.title}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground">{relativeTime(item.createdAt)}</span>
                                </span>
                            </Link>
                        )
                    })}
                </div>
                <DropdownMenuSeparator className="m-0" />
                <Link href="/dashboard/approvals" className="block px-4 py-3 text-center text-sm font-semibold text-orange-600 hover:bg-muted">
                    Open approval center
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
