"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SocialMediaForm } from "@/components/dashboard/settings/social-media-form"
import { type SocialMediaLink } from "@/types/social-media"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function SocialMediaSettingsClient() {
    const [links, setLinks] = useState<SocialMediaLink[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingLink, setEditingLink] = useState<SocialMediaLink | undefined>(undefined)
    const supabase = createClient()
    const { toast } = useToast()

    const fetchLinks = useEffectEvent(async () => {
        try {
            const { data, error } = await supabase
                .from("social_media_links")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) {
                throw error
            }

            setLinks(data || [])
        } catch (error) {
            console.error("Error fetching social media links:", error)
            toast({
                title: "Error",
                description: "Failed to load social media links.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    })

    useEffect(() => {
        void fetchLinks()

        const channel = supabase
            .channel("social_media_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "social_media_links",
                },
                () => {
                    void fetchLinks()
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [supabase])

    async function handleDelete(id: number) {
        try {
            const { error } = await supabase
                .from("social_media_links")
                .delete()
                .eq("id", id)

            if (error) {
                throw error
            }

            toast({
                title: "Success",
                description: "Social media link deleted successfully.",
            })
        } catch (error) {
            console.error("Error deleting link:", error)
            toast({
                title: "Error",
                description: "Failed to delete link.",
                variant: "destructive",
            })
        }
    }

    function openEditDialog(link: SocialMediaLink) {
        setEditingLink(link)
        setIsDialogOpen(true)
    }

    function closeDialog() {
        setIsDialogOpen(false)
        setEditingLink(undefined)
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Social Media Links</h2>
                <div className="flex items-center space-x-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingLink(undefined)}>
                                <Plus className="mr-2 h-4 w-4" /> Add New
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingLink ? "Edit Social Media Link" : "Add Social Media Link"}
                                </DialogTitle>
                                <DialogDescription>
                                    Manage your social media presence here.
                                </DialogDescription>
                            </DialogHeader>
                            <SocialMediaForm
                                initialData={editingLink}
                                onSuccess={closeDialog}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>
                        Manage external links to your social media profiles.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-4">Loading...</div>
                    ) : links.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                            <p>No social media links found.</p>
                            <Button
                                variant="link"
                                onClick={() => {
                                    setEditingLink(undefined)
                                    setIsDialogOpen(true)
                                }}
                            >
                                Add your first link
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Platform</TableHead>
                                        <TableHead>URL</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {links.map((link) => (
                                        <TableRow key={link.id}>
                                            <TableCell className="font-medium">
                                                {link.platform}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center hover:underline"
                                                >
                                                    {link.url}
                                                    <ExternalLink className="ml-1 h-3 w-3" />
                                                </a>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={link.is_active ? "default" : "secondary"}
                                                >
                                                    {link.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditDialog(link)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                                                        onClick={() => {
                                                            if (window.confirm("Are you sure you want to delete this social media link?")) {
                                                                void handleDelete(link.id)
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
