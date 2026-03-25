"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

const data = [
    { name: "Jan", profit: 14000, loss: 10000 },
    { name: "Feb", profit: 12000, loss: 8000 },
    { name: "Mar", profit: 13000, loss: 5000 },
    { name: "Apr", profit: 11000, loss: 14000 },
    { name: "May", profit: 12500, loss: 6000 },
    { name: "Jun", profit: 8000, loss: 6000 },
    { name: "Jul", profit: 10000, loss: 7000 },
    { name: "Aug", profit: 14000, loss: 9000 },
    { name: "Sep", profit: 12000, loss: 7000 },
]

export function RevenueChart() {
    return (
        <Card className="col-span-4 lg:col-span-3 glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Total Revenue</CardTitle>
                    <p className="text-xl font-bold mt-2">₦5,000,000</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center text-xs">
                        <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))] mr-1"></span> Profit
                    </div>
                    <div className="flex items-center text-xs">
                        <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-5))] mr-1"></span> Loss
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data}>
                        <XAxis
                            dataKey="name"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid hsl(var(--border))',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                backgroundColor: 'hsl(var(--card))',
                                color: 'hsl(var(--card-foreground))'
                            }}
                        />
                        <Bar dataKey="profit" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="loss" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
