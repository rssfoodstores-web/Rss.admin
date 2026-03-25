"use client"

import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { NavMain } from "@/components/nav-main"
import type { AdminRouteKey } from "@/lib/admin-routes"

export function MobileSidebar({
    allowedRouteKeys,
}: {
    allowedRouteKeys: AdminRouteKey[]
}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden mr-2">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-background w-72">
                <SheetTitle className="sr-only">Admin dashboard navigation</SheetTitle>
                <NavMain mobile allowedRouteKeys={allowedRouteKeys} />
            </SheetContent>
        </Sheet>
    )
}
