export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { User, Phone, MapPin } from "lucide-react"
import Image from "next/image"
import { RiderApprovalButtons } from "@/components/dashboard/users/rider-approval-buttons"
import { AgentApprovalButtons } from "@/components/dashboard/users/agent-approval-buttons"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function UserProfilePage({ params }: PageProps) {
    await requireAdminRouteAccess("accounts")
    const { id } = await params
    const supabase = await createClient()

    // Fetch comprehensive user data separately to avoid foreign key issues
    const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single()

    const riderProfilePromise = supabase
        .from("rider_profiles")
        .select("*")
        .eq("id", id)
        .single()

    const agentProfilePromise = supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", id)
        .single()

    const merchantProfilePromise = supabase
        .from("merchants")
        .select("*")
        .eq("id", id)
        .single()

    const [profileResult, riderResult, agentResult, merchantResult] = await Promise.all([
        profilePromise,
        riderProfilePromise,
        agentProfilePromise,
        merchantProfilePromise
    ])

    const profile = profileResult.data

    if (profileResult.error || !profile) {
        console.error("Error fetching user profile:", profileResult.error)
        return notFound()
    }

    const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .single()

    const riderProfile = riderResult.data
    const agentProfile = agentResult.data
    const merchantProfile = merchantResult.data
    const role = userRole?.role
        || (agentProfile ? "agent" : riderProfile ? "rider" : merchantProfile ? "merchant" : "customer")

    return (
        <div className="flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border">
                        {profile.avatar_url ? (
                            <Image
                                src={profile.avatar_url}
                                alt={profile.full_name || "User"}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                <User className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{profile.full_name || "Unknown User"}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">
                                {role.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                                Joined {new Date(profile.updated_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    {agentProfile && <TabsTrigger value="agent">Agent Profile</TabsTrigger>}
                    {riderProfile && <TabsTrigger value="rider">Rider Profile</TabsTrigger>}
                    {merchantProfile && <TabsTrigger value="merchant">Merchant Profile</TabsTrigger>}
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{profile.phone || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                    {[
                                        profile.house_number,
                                        profile.street_address,
                                        profile.city, // Assuming city exists, though not in your strict query earlier, adjust if needed
                                        profile.state
                                    ].filter(Boolean).join(", ") || "No Address"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Account Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3">
                            <div className="p-4 border rounded-lg">
                                <span className="text-sm text-muted-foreground">Points Balance</span>
                                <p className="text-2xl font-bold">{profile.points_balance || 0}</p>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <span className="text-sm text-muted-foreground">Referral Code</span>
                                <p className="text-xl font-mono">{profile.referral_code || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {agentProfile && (
                    <TabsContent value="agent" className="mt-6 space-y-6">
                        <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                            <div>
                                <h3 className="text-lg font-semibold">Agent Application Status</h3>
                                <p className="text-sm text-muted-foreground">Current status: <span className="capitalize font-medium text-foreground">{agentProfile.status}</span></p>
                            </div>
                            <AgentApprovalButtons agentId={agentProfile.id} status={agentProfile.status} />
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Bank Details</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 border rounded-lg">
                                    <span className="text-sm text-muted-foreground">Bank Name</span>
                                    <p className="font-medium">{agentProfile.bank_details?.bankName || "N/A"}</p>
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <span className="text-sm text-muted-foreground">Account Number</span>
                                    <p className="font-medium">{agentProfile.bank_details?.accountNumber || "N/A"}</p>
                                </div>
                                <div className="p-4 border rounded-lg md:col-span-2">
                                    <span className="text-sm text-muted-foreground">Account Name</span>
                                    <p className="font-medium">{agentProfile.bank_details?.accountName || "N/A"}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Identity & Guarantors</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-4">
                                    <h4 className="font-medium">Identity Document</h4>
                                    {agentProfile.id_card_url ? (
                                        <div className="space-y-2">
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                                <Image
                                                    src={agentProfile.id_card_url}
                                                    alt="Agent ID Card"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                            <a href={agentProfile.id_card_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open Original</a>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No ID document uploaded.</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-medium">Guarantors</h4>
                                    {(["guarantor1", "guarantor2"] as const).map((key) => {
                                        const guarantor = agentProfile.guarantors?.[key]

                                        return (
                                            <div key={key} className="rounded-lg border p-4">
                                                <p className="font-medium capitalize">{key.replace("guarantor", "Guarantor ")}</p>
                                                <div className="mt-2 grid gap-1 text-sm">
                                                    <p><span className="text-muted-foreground">Name:</span> {guarantor?.name || "N/A"}</p>
                                                    <p><span className="text-muted-foreground">Phone:</span> {guarantor?.phone || "N/A"}</p>
                                                    <p><span className="text-muted-foreground">Address:</span> {guarantor?.address || "N/A"}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Rider Profile Tab */}
                {riderProfile && (
                    <TabsContent value="rider" className="mt-6 space-y-6">
                        <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                            <div>
                                <h3 className="text-lg font-semibold">Rider Application Status</h3>
                                <p className="text-sm text-muted-foreground">Current status: <span className="capitalize font-medium text-foreground">{riderProfile.status}</span></p>
                            </div>
                            <RiderApprovalButtons riderId={riderProfile.id} status={riderProfile.status} />
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Bike Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {riderProfile.bike_particulars?.license_url && (
                                        <div className="space-y-2">
                                            <span className="text-sm font-medium">Bike License</span>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                                <Image
                                                    src={riderProfile.bike_particulars.license_url}
                                                    alt="License"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                            <a href={riderProfile.bike_particulars.license_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open Original</a>
                                        </div>
                                    )}
                                    {riderProfile.bike_particulars?.insurance_url && (
                                        <div className="space-y-2">
                                            <span className="text-sm font-medium">Insurance</span>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                                <Image
                                                    src={riderProfile.bike_particulars.insurance_url}
                                                    alt="Insurance"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                            <a href={riderProfile.bike_particulars.insurance_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open Original</a>
                                        </div>
                                    )}
                                    {riderProfile.bike_particulars?.roadworthiness_url && (
                                        <div className="space-y-2">
                                            <span className="text-sm font-medium">Road Worthiness</span>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/20">
                                                <Image
                                                    src={riderProfile.bike_particulars.roadworthiness_url}
                                                    alt="Road Worthiness"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                            <a href={riderProfile.bike_particulars.roadworthiness_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open Original</a>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Identity & Guarantor</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <h4 className="font-medium mb-4">Rider Identity</h4>
                                    <div className="grid gap-4">
                                        {riderProfile.id_card_url && (
                                            <div className="space-y-2">
                                                <span className="text-xs text-muted-foreground">ID Card</span>
                                                <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                                    <Image
                                                        src={riderProfile.id_card_url}
                                                        alt="ID Card"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {riderProfile.passport_photo_url && (
                                            <div className="space-y-2">
                                                <span className="text-xs text-muted-foreground">Passport Photo</span>
                                                <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-md border">
                                                    <Image
                                                        src={riderProfile.passport_photo_url}
                                                        alt="Passport"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-4">Guarantor Information</h4>
                                    <div className="grid gap-2 mb-4">
                                        <div className="grid grid-cols-2">
                                            <span className="text-sm text-muted-foreground">Name:</span>
                                            <span className="text-sm font-medium">{riderProfile.guarantors?.name || "N/A"}</span>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <span className="text-sm text-muted-foreground">Phone:</span>
                                            <span className="text-sm font-medium">{riderProfile.guarantors?.phone || "N/A"}</span>
                                        </div>
                                    </div>
                                    {riderProfile.guarantors?.form_url && (
                                        <div className="space-y-2">
                                            <span className="text-xs text-muted-foreground">Guarantor Form</span>
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                                <Image
                                                    src={riderProfile.guarantors.form_url}
                                                    alt="Guarantor Form"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <a href={riderProfile.guarantors.form_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open Original</a>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Merchant Profile Tab */}
                {merchantProfile && (
                    <TabsContent value="merchant" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Merchant Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="p-4 border rounded-lg">
                                        <span className="text-sm text-muted-foreground">Business Name</span>
                                        <p className="font-medium">{merchantProfile.business_name || profile.company_name || "N/A"}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <span className="text-sm text-muted-foreground">Status</span>
                                        <Badge variant={merchantProfile.status === "active" ? "default" : "secondary"}>
                                            {merchantProfile.status}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
