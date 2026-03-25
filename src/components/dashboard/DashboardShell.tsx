"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Bell, Menu } from "lucide-react"
import { useSidebar } from "@/components/dashboard/sidebar-provider"
import { UserNav } from "@/components/dashboard/user-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { NavMain } from "@/components/nav-main"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import type { AdminRouteKey } from "@/lib/admin-routes"

interface DashboardShellProps {
    allowedRouteKeys: AdminRouteKey[]
    children: React.ReactNode
}

export function DashboardShell({ allowedRouteKeys, children }: DashboardShellProps) {
    const { toggleSidebar } = useSidebar()
    const pathname = usePathname()

    return (
        <div className="flex min-h-screen w-full bg-transparent">
            <NavMain allowedRouteKeys={allowedRouteKeys} />
            <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/60 px-6 backdrop-blur-md">
                    <MobileSidebar allowedRouteKeys={allowedRouteKeys} />

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

                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                        </Button>

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
