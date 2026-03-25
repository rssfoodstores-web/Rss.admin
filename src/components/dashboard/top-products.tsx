import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const products = [
    { name: "Bag Of Rice", percentage: 70 },
    { name: "Meat", percentage: 40 },
    { name: "Beans", percentage: 60 },
    { name: "Fruit", percentage: 80 },
    { name: "Egg", percentage: 30 },
]

export function TopProducts() {
    return (
        <Card className="col-span-4 lg:col-span-1 glass-card">
            <CardHeader>
                <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {products.map((product) => (
                        <div key={product.name} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{product.name}</span>
                                <span className="text-muted-foreground">{product.percentage}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${product.percentage}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
