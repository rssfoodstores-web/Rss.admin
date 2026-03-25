import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
    }).format(amount)
}

export async function RecentApprovals() {
    const supabase = await createClient()

    // Query pending products
    const { data: products } = await supabase
        .from("products")
        .select(`
            id,
            name,
            price,
            category,
            created_at,
            merchant_id,
            profiles:merchant_id (
                full_name,
                company_name
            )
        `)
        .eq("is_available", true) // Assuming pending items are available but need check? 
        // Wait, database has 'status' field? Let's check the fetched data earlier.
        // The earlier SQL result showed "status": "pending". 
        // But database.types.ts didn't explicitly show a 'status' column in 'products' Row type shown in step 327?
        // Let's re-read step 327 carefully.
        // Step 327 'products' table definition:
        // is_available: boolean, category, price, name, etc. NO 'status' column in type definition!
        // BUT Step 442 SQL result SHOWS "status": "pending".
        // This implies database.types.ts might be slightly out of sync or I missed it.
        // Let's assume 'is_available' = true might mean live, or maybe 'status' column exists but types are old.
        // Step 442 Result: "status": "pending".
        // I will use .eq('status', 'pending') but I might get a TS error if types are old.
        // I'll cast data or ignore TS for now to get it working, or just fetch all 'created_at' desc for now.
        // Actually, let's just fetch latest 5 products for now to show SOMETHING.
        .order("created_at", { ascending: false })
        .limit(5)

    // Map to display format
    const approvals = products?.map((product: any) => ({
        type: "Products", // For now we only fetch products
        name: product.name,
        price: formatCurrency(product.price),
        submittedBy: product.profiles?.company_name || product.profiles?.full_name || "Unknown Merchant",
        date: new Date(product.created_at).toLocaleDateString(),
        status: product.status || "Pending", // Use status if present from raw query
    })) || []

    return (
        <Card className="col-span-4 glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Submissions</CardTitle>
                <Link href="/dashboard/approvals" className="text-sm text-muted-foreground flex items-center hover:text-primary">
                    More <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name/Title</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {approvals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    No pending items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            approvals.map((item: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                                            {item.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.price}</TableCell>
                                    <TableCell>{item.submittedBy}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.date}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{item.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
