"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Video, Image as ImageIcon } from "lucide-react"
import { createAd } from "@/actions/ads"
import { toast } from "sonner"
import { getActionError } from "@/lib/action-result"

export function CreateAdDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mediaType, setMediaType] = useState<"image" | "video">("image")

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)

        try {
            const formData = new FormData(event.currentTarget)
            formData.append("mediaType", mediaType)

            const result = await createAd(formData)
            const error = getActionError(result)

            if (error) {
                toast.error(error)
            } else {
                setOpen(false)
                toast.success("Ad created successfully")
            }
        } catch (error) {
            console.error(error)
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white">
                    <Upload className="mr-2 h-4 w-4" />
                    Create New Campaign
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Ad Campaign</DialogTitle>
                    <DialogDescription>
                        Upload an image or video to display on the platform.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="Summer Sale"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Type</Label>
                            <div className="flex gap-2 col-span-3">
                                <Button
                                    type="button"
                                    variant={mediaType === "image" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setMediaType("image")}
                                >
                                    <ImageIcon className="mr-2 h-4 w-4" /> Image
                                </Button>
                                <Button
                                    type="button"
                                    variant={mediaType === "video" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setMediaType("video")}
                                >
                                    <Video className="mr-2 h-4 w-4" /> Video
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="file" className="text-right">
                                File
                            </Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept={mediaType === "image" ? "image/*" : "video/*"}
                                className="col-span-3 cursor-pointer"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? "Uploading..." : "Create Campaign"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
