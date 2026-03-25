export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { AccountsDataTable } from "@/components/dashboard/accounts/accounts-data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AccountsPage() {
    await requireAdminRouteAccess("accounts")
    const supabase = await createClient()

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
            id, 
            full_name, 
            phone, 
            company_name, 
            street_address, 
            house_number, 
            state, 
            zip_code, 
            updated_at, 
            avatar_url, 
            points_balance, 
            referral_code, 
            location_locked
        `)
        .order("updated_at", { ascending: false })

    if (profilesError) {
        console.error("AccountsPage: Error fetching profiles:", JSON.stringify(profilesError, null, 2))
    }

    const profileIds = profiles?.map(p => p.id) || []

    const rolesMap = new Map()
    const riderStatusMap = new Map()
    const agentStatusMap = new Map()
    const merchantStatusMap = new Map()

    if (profileIds.length > 0) {
        const [{ data: userRoles, error: rolesError }, { data: riderProfiles }, { data: agentProfiles }, { data: merchants }] = await Promise.all([
            supabase
                .from("user_roles")
                .select("user_id, role")
                .in("user_id", profileIds),
            supabase
                .from("rider_profiles")
                .select("id, status")
                .in("id", profileIds),
            supabase
                .from("agent_profiles")
                .select("id, status")
                .in("id", profileIds),
            supabase
                .from("merchants")
                .select("id, status")
                .in("id", profileIds),
        ])

        if (rolesError) {
            console.error("AccountsPage: Error fetching roles:", rolesError)
        }

        userRoles?.forEach(ur => rolesMap.set(ur.user_id, ur.role))
        riderProfiles?.forEach(profile => riderStatusMap.set(profile.id, profile.status))
        agentProfiles?.forEach(profile => agentStatusMap.set(profile.id, profile.status))
        merchants?.forEach(profile => merchantStatusMap.set(profile.id, profile.status))
    }

    const users = profiles?.map(profile => {
        const riderStatus = riderStatusMap.get(profile.id) || null
        const agentStatus = agentStatusMap.get(profile.id) || null
        const merchantStatus = merchantStatusMap.get(profile.id) || null
        const inferredRole = rolesMap.get(profile.id)
            || (agentStatus ? "agent" : merchantStatus ? "merchant" : riderStatus ? "rider" : "customer")

        return {
            ...profile,
            role: inferredRole,
            status: agentStatus || merchantStatus || riderStatus,
        }
    }) || []

    const totalAccounts = users.length
    const pendingApprovals = users.filter(u => u.status === "pending").length
    const administrativeSeats = users.filter(u => u.role === "admin" || u.role === "supa_admin" || u.role === "sub_admin").length
    const networkPartners = users.filter(u => u.role === "agent" || u.role === "rider").length

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Accounts</h1>
                <p className="text-muted-foreground mt-1 text-base">
                    Manage user accounts, view details, and send notifications.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{totalAccounts}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Approvals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{pendingApprovals}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Delivery & Support Network</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{networkPartners}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Admin Seats</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{administrativeSeats}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="animate-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
                <AccountsDataTable data={users} />
            </div>
        </div>
    )
}
