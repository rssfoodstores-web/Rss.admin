export const dynamic = "force-dynamic"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { getManualCreatedAccountRecords } from "@/lib/manual-account-records"
import type { ManualCreatedAccountRecord } from "@/types/manual-accounts"
import { CreatedAccountsDirectory } from "./CreatedAccountsDirectory"

export default async function CreatedAccountsPage() {
    const access = await requireAdminRouteAccess("accounts")
    let accounts: ManualCreatedAccountRecord[] = []
    let errorMessage: string | null = null

    try {
        accounts = await getManualCreatedAccountRecords()
    } catch (error) {
        console.error("CreatedAccountsPage: Could not load created accounts:", error)
        errorMessage = "Created accounts could not be loaded right now. Please refresh and try again."
    }

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Created Users</h1>
                    <p className="mt-1 text-base text-muted-foreground">
                        Search and inspect accounts registered through the Add Users workflow.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/accounts">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Add Users
                    </Link>
                </Button>
            </div>

            <CreatedAccountsDirectory
                accounts={accounts}
                canViewFullProfiles={access.allowedRouteKeys.includes("account_info")}
                errorMessage={errorMessage}
            />
        </div>
    )
}
