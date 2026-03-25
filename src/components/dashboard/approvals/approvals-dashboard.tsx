"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ApprovalsTable } from "./approvals-table"
import { RidersTable } from "./riders-table"
import { MerchantsTable } from "./merchants-table"

interface ApprovalsDashboardProps {
    products: any[]
    riders: any[]
    merchants: any[]
}

export function ApprovalsDashboard({ products, riders, merchants }: ApprovalsDashboardProps) {
    return (
        <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                <TabsTrigger value="products">Products ({products?.length || 0})</TabsTrigger>
                <TabsTrigger value="riders">Riders ({riders?.length || 0})</TabsTrigger>
                <TabsTrigger value="merchants">Merchants ({merchants?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Products</CardTitle>
                        <CardDescription>
                            Review and manage pending product submissions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ApprovalsTable products={products || []} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="riders" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Riders</CardTitle>
                        <CardDescription>
                            Review and manage new rider applications and documents.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RidersTable riders={riders || []} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="merchants" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Merchants</CardTitle>
                        <CardDescription>
                            Review and manage new merchant account requests.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MerchantsTable merchants={merchants || []} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
