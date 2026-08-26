export const dynamic = "force-dynamic"

import Link from "next/link"
import { UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { ManualAccountCreator } from "./ManualAccountCreator"

export default async function AccountsPage() {
    const access = await requireAdminRouteAccess("accounts")

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Add Users</h1>
                    <p className="text-muted-foreground mt-1 text-base">
                        Create confirmed user accounts and assign their first role without exposing account information.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/accounts/created">
                        <UsersRound className="mr-2 h-4 w-4" />
                        View created users
                    </Link>
                </Button>
            </div>

            <ManualAccountCreator canCreateAdminRoles={access.primaryRole !== "sub_admin"} />
        </div>
    )
}
