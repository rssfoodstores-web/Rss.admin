import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface StatsCardProps {
    title: string
    value: string
    trend: string
    trendUp: boolean
}

export function StatsCard({ title, value, trend, trendUp }: StatsCardProps) {
    return (
        <Card className="glass-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground/80">
                    {title}
                </CardTitle>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${trendUp ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"} flex items-center`}>
                    {trend}
                    {trendUp ? <ArrowUpRight className="ml-1 h-3 w-3" /> : <ArrowDownRight className="ml-1 h-3 w-3" />}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
            </CardContent>
        </Card>
    )
}
