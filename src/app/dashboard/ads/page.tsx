import { getAds, deleteAd, toggleAdStatus } from "@/actions/ads"
import { CreateAdDialog } from "@/components/dashboard/ads/create-ad-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Power } from "lucide-react"
import Image from "next/image"
import type { Tables } from "@/types/database.types"

type Ad = Tables<"ads">

export default async function AdsPage() {
    const ads = await getAds()

    async function toggleAdStatusForm(formData: FormData) {
        "use server"
        await toggleAdStatus(
            String(formData.get("id") ?? ""),
            String(formData.get("current_status") ?? "false") === "true"
        )
    }

    async function deleteAdForm(formData: FormData) {
        "use server"
        await deleteAd(
            String(formData.get("id") ?? ""),
            String(formData.get("public_id") ?? ""),
            String(formData.get("media_type") ?? "image") as "image" | "video"
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ads Management</h1>
                    <p className="text-muted-foreground">Manage platform advertisements and promotional banners.</p>
                </div>
                <CreateAdDialog />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {ads.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border rounded-lg border-dashed text-muted-foreground">
                        <p>No active campaigns found. Create one to get started.</p>
                    </div>
                ) : (
                    ads.map((ad: Ad) => (
                        <Card key={ad.id} className="overflow-hidden">
                            <div className="aspect-video relative bg-black/5">
                                {ad.media_type === "video" ? (
                                    <video src={ad.media_url} controls className="w-full h-full object-contain" />
                                ) : (
                                    <Image
                                        src={ad.media_url}
                                        alt={ad.title}
                                        fill
                                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                        className="object-cover"
                                    />
                                )}
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <Badge variant={ad.is_active ? "default" : "destructive"}>
                                        {ad.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>
                            <CardHeader className="p-4">
                                <CardTitle className="text-lg truncate" title={ad.title}>{ad.title}</CardTitle>
                                <CardDescription className="text-xs">
                                    Created: {ad.created_at ? new Date(ad.created_at).toLocaleDateString() : "Unknown"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 flex gap-2">
                                <form action={toggleAdStatusForm} className="flex-1">
                                    <input type="hidden" name="id" value={ad.id} />
                                    <input type="hidden" name="current_status" value={String(ad.is_active)} />
                                    <Button variant="outline" size="sm" className="w-full">
                                        <Power className="mr-2 h-3 w-3" />
                                        {ad.is_active ? "Disable" : "Enable"}
                                    </Button>
                                </form>
                                <form action={deleteAdForm} className="flex-1">
                                    <input type="hidden" name="id" value={ad.id} />
                                    <input type="hidden" name="public_id" value={ad.public_id ?? ""} />
                                    <input type="hidden" name="media_type" value={ad.media_type ?? "image"} />
                                    <Button variant="destructive" size="sm" className="w-full">
                                        <Trash2 className="mr-2 h-3 w-3" />
                                        Delete
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
