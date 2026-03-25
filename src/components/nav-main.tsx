"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    CheckSquare,
    ShoppingCart,
    Bell,
    MessageSquare,
    MapPin,
    Wallet,
    Settings,
    LogOut,
    Users,
    ShieldAlert,
    Megaphone,
    CircleHelp,
    FileText,
    Shield,
    type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useSidebar } from "@/components/dashboard/sidebar-provider"
import { type AdminRouteKey } from "@/lib/admin-routes"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
    key: AdminRouteKey
    title: string
    href: string
    icon: LucideIcon
}

const navItems: NavItem[] = [
    {
        key: "dashboard",
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        key: "approvals",
        title: "Approvals",
        href: "/dashboard/approvals",
        icon: CheckSquare,
    },
    {
        key: "orders",
        title: "Orders",
        href: "/dashboard/orders",
        icon: ShoppingCart,
    },
    {
        key: "notifications",
        title: "Notifications",
        href: "/dashboard/notifications",
        icon: Bell,
    },
    {
        key: "messages",
        title: "Messages",
        href: "/dashboard/messages",
        icon: MessageSquare,
    },
    {
        key: "reports",
        title: "Finance",
        href: "/dashboard/reports",
        icon: Wallet,
    },
    {
        key: "location_access",
        title: "Location Access",
        href: "/dashboard/location-access",
        icon: MapPin,
    },
    {
        key: "ads",
        title: "Ads",
        href: "/dashboard/ads",
        icon: Megaphone,
    },
    {
        key: "referrals",
        title: "Referrals",
        href: "/dashboard/referrals",
        icon: Users,
    },
    {
        key: "rewards",
        title: "Rewards",
        href: "/dashboard/rewards",
        icon: Wallet,
    },
    {
        key: "cook_off",
        title: "Cook-Off",
        href: "/dashboard/cook-off",
        icon: CheckSquare,
    },
    {
        key: "discount_bundles",
        title: "Bundle Deals",
        href: "/dashboard/discount-bundles",
        icon: ShoppingCart,
    },
    {
        key: "contact",
        title: "Contact Page",
        href: "/dashboard/contact",
        icon: MessageSquare,
    },
    {
        key: "faqs",
        title: "FAQ Page",
        href: "/dashboard/faqs",
        icon: CircleHelp,
    },
    {
        key: "terms",
        title: "Terms Page",
        href: "/dashboard/terms",
        icon: FileText,
    },
    {
        key: "privacy",
        title: "Privacy Page",
        href: "/dashboard/privacy",
        icon: Shield,
    },
    {
        key: "support",
        title: "Support Chat",
        href: "/dashboard/support",
        icon: Bell,
    },
    {
        key: "accounts",
        title: "Accounts",
        href: "/dashboard/accounts",
        icon: Users,
    },
    {
        key: "admins",
        title: "Admins",
        href: "/dashboard/admins",
        icon: ShieldAlert,
    },
    {
        key: "audit_logs",
        title: "Audit Logs",
        href: "/dashboard/audit-logs",
        icon: ShieldAlert,
    },
    {
        key: "settings",
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
    },
]

export function NavMain({
    mobile = false,
    allowedRouteKeys,
}: {
    allowedRouteKeys: AdminRouteKey[]
    mobile?: boolean
}) {
    const pathname = usePathname()
    const { isCollapsed } = useSidebar()

    const filteredItems = navItems.filter((item) => allowedRouteKeys.includes(item.key))

    // On mobile, never collapse
    const collapsed = mobile ? false : isCollapsed

    return (
        <div className={cn(
            "bg-background/80 backdrop-blur-xl flex flex-col transition-all duration-300",
            mobile ? "flex w-full h-full" : "hidden lg:flex border-r min-h-screen sticky top-0 z-40",
            !mobile && (collapsed ? "w-16" : "w-64")
        )}>
            <div className={cn("flex h-16 items-center px-6", !mobile && "border-b", collapsed ? "justify-center px-0" : "")}>
                <div className={cn("relative transition-all duration-300", collapsed ? "w-8 h-8" : "w-32 h-10")}>
                    <Image
                        src="/Rss logo.png"
                        alt="RSS Foods"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
            </div>
            <div className="flex-1 py-4">
                <nav className="grid items-start px-2 text-sm font-medium">
                    <TooltipProvider>
                        {filteredItems.map((item, index) => {
                            const Icon = item.icon
                            // Check for exact match for dashboard, or startsWith for other routes
                            const isActive = item.href === "/dashboard"
                                ? pathname === "/dashboard"
                                : pathname?.startsWith(item.href)

                            const LinkComponent = (
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-muted hover:text-primary",
                                        isActive
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                                            : "text-muted-foreground",
                                        collapsed ? "justify-center" : ""
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {!collapsed && <span>{item.title}</span>}
                                </Link>
                            )

                            if (collapsed) {
                                return (
                                    <Tooltip key={index} delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            {LinkComponent}
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            {item.title}
                                        </TooltipContent>
                                    </Tooltip>
                                )
                            }

                            return (
                                <div key={index}>
                                    {LinkComponent}
                                </div>
                            )
                        })}
                    </TooltipProvider>
                </nav>
            </div>
            <div className="p-4 border-t">
                {!collapsed ? (
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="w-full justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                        <LogOut className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
