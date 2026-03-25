"use client"

import { useState, useEffect, useEffectEvent } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { sendUserMessage } from "@/actions/notifications"
import { Badge } from "@/components/ui/badge"

export function NotificationsPageClient() {
    const searchParams = useSearchParams()
    const urlUserId = searchParams.get("userId")
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([])
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")

    const fetchUser = useEffectEvent(async (userId: string) => {
        setSearchLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from("profiles")
            .select("id, full_name, email, role:user_roles(role)")
            .eq("id", userId)
            .single()

        if (data) {
            const roleData = data.role as { role?: string } | null
            setSelectedUser({
                ...data,
                role: roleData?.role ?? "customer",
            })
        }
        setSearchLoading(false)
    })

    useEffect(() => {
        if (urlUserId) {
            void fetchUser(urlUserId)
        }
    }, [urlUserId])

    async function handleSearch(event: React.FormEvent) {
        event.preventDefault()
        if (!searchQuery.trim()) {
            return
        }

        setSearchLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from("profiles")
            .select("id, full_name, role:user_roles(role)")
            .ilike("full_name", `%${searchQuery}%`)
            .limit(5)

        if (data) {
            setSearchResults(
                data.map((row) => {
                    const roleData = row.role as { role?: string } | null
                    return {
                        ...row,
                        role: roleData?.role ?? "customer",
                    }
                })
            )
        }
        setSearchLoading(false)
    }

    async function handleSend(event: React.FormEvent) {
        event.preventDefault()
        if (!selectedUser || !title || !message) {
            toast({
                title: "Error",
                description: "Please select a user and fill in all fields.",
                variant: "destructive",
            })
            return
        }

        setLoading(true)
        const formData = new FormData()
        formData.append("userId", String(selectedUser.id ?? ""))
        formData.append("title", title)
        formData.append("message", message)

        const result = await sendUserMessage({}, formData)

        if (result.message === "success") {
            toast({
                title: "Message Sent",
                description: `Notification sent to ${String(selectedUser.full_name ?? "the selected user")}.`,
            })
            setTitle("")
            setMessage("")
        } else {
            toast({
                title: "Error",
                description: result.message || "Failed to send message.",
                variant: "destructive",
            })
        }
        setLoading(false)
    }

    return (
        <div className="flex w-full max-w-4xl flex-col gap-6 mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Notifications Center</h1>
                <p className="text-muted-foreground">Send direct messages and alerts to users.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Recipient</CardTitle>
                        <CardDescription>Search for a user to message</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                            <Button type="submit" variant="secondary" disabled={searchLoading}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>

                        {searchResults.length > 0 && !selectedUser ? (
                            <div className="max-h-[200px] divide-y overflow-y-auto rounded-md border">
                                {searchResults.map((user) => (
                                    <div
                                        key={String(user.id)}
                                        className="flex cursor-pointer items-center justify-between p-3 hover:bg-muted"
                                        onClick={() => {
                                            setSelectedUser(user)
                                            setSearchResults([])
                                            setSearchQuery("")
                                        }}
                                    >
                                        <span className="font-medium">{String(user.full_name ?? "Unknown user")}</span>
                                        <Badge variant="outline" className="text-xs">{String(user.role ?? "customer")}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {selectedUser ? (
                            <div className="rounded-lg border border-primary/20 bg-muted/50 p-4">
                                <div className="mb-2 flex items-start justify-between">
                                    <h3 className="font-bold">{String(selectedUser.full_name ?? "Selected user")}</h3>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="h-auto p-0 text-muted-foreground hover:text-destructive">
                                        Change
                                    </Button>
                                </div>
                                <div className="text-sm text-muted-foreground">ID: {String(selectedUser.id ?? "")}</div>
                                <Badge className="mt-2 capitalize">{String(selectedUser.role ?? "customer")}</Badge>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                                No user selected. Search or check the URL.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Compose Message</CardTitle>
                        <CardDescription>Send a notification to their dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSend} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Subject / Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Important Update"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Message Body</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Type your message here..."
                                    className="min-h-[150px]"
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading || !selectedUser}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Send Notification
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
