"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Menu } from "lucide-react"
import { useSidebar } from "@/components/dashboard/sidebar-provider"
import { UserNav } from "@/components/dashboard/user-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { NavMain } from "@/components/nav-main"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import type { AdminRouteKey } from "@/lib/admin-routes"
import type { AdminActivitySnapshot } from "@/lib/admin-activity"
import { AdminActivityMenu } from "@/components/dashboard/AdminActivityMenu"
import { useEffect, useState } from "react"

interface DashboardShellProps {
    allowedRouteKeys: AdminRouteKey[]
    initialActivity: AdminActivitySnapshot
    children: React.ReactNode
}

export function DashboardShell({ allowedRouteKeys, initialActivity, children }: DashboardShellProps) {
    const { toggleSidebar } = useSidebar()
    const pathname = usePathname()
    const [activity, setActivity] = useState(initialActivity)
    const [activityLoading, setActivityLoading] = useState(false)

    useEffect(() => {
        let active = true
        const refreshActivity = async () => {
            setActivityLoading(true)
            try {
                const response = await fetch("/api/admin/activity", { cache: "no-store" })
                if (response.ok && active) setActivity(await response.json())
            } finally {
                if (active) setActivityLoading(false)
            }
        }
        void refreshActivity()
        const interval = window.setInterval(refreshActivity, 30_000)
        return () => { active = false; window.clearInterval(interval) }
    }, [pathname])

    return (
        <div className="flex min-h-screen w-full bg-transparent">
            <NavMain allowedRouteKeys={allowedRouteKeys} activityCounts={activity.counts} />
            <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/60 px-6 backdrop-blur-md">
                    <MobileSidebar allowedRouteKeys={allowedRouteKeys} activityCounts={activity.counts} />

                    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 hidden lg:flex">
                        <Menu className="h-5 w-5" />
                    </Button>

                    <h1 className="text-lg font-bold">Dashboard</h1>
                    <div className="ml-auto flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search data, users, or reports"
                                className="w-[300px] rounded-full bg-muted pl-8"
                            />
                        </div>

                        <AdminActivityMenu activity={activity} loading={activityLoading} />

                        <ThemeToggle />

                        <UserNav />
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}
