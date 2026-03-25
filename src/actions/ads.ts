"use server"

import cloudinary from "@/lib/cloudinary"
import { revalidatePath } from "next/cache"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import type { UploadApiResponse } from "cloudinary"

interface UploadedAdAsset {
    public_id: string
    secure_url: string
}

export async function getAds() {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase
    const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching ads:", error)
        return []
    }
    return data
}

export async function createAd(formData: FormData) {
    const access = await requireAdminRouteAccess("ads")
    const title = formData.get("title") as string
    const file = formData.get("file") as File
    const mediaType = formData.get("mediaType") as "image" | "video"

    if (!file || !title) {
        return { error: "Missing file or title" }
    }

    try {
        // 1. Upload to Cloudinary
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const uploadResult = await new Promise<UploadedAdAsset>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: "rssa-ads",
                    resource_type: mediaType,
                },
                (error, result) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    if (!result) {
                        reject(new Error("Cloudinary upload returned no result"))
                        return
                    }

                    const typedResult = result as UploadApiResponse
                    resolve({
                        public_id: typedResult.public_id,
                        secure_url: typedResult.secure_url,
                    })
                }
            )
            uploadStream.end(buffer)
        })

        // 2. Insert into Database
        const supabase = access.supabase
        const { error: dbError } = await supabase.from("ads").insert({
            title,
            media_url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            media_type: mediaType,
            is_active: true,
        })

        if (dbError) throw dbError

        revalidatePath("/dashboard/ads")
        return { success: true }
    } catch (error) {
        console.error("Error creating ad:", error)
        return { error: "Failed to create ad" }
    }
}

export async function deleteAd(id: string, publicId: string, mediaType: "image" | "video") {
    try {
        const access = await requireAdminRouteAccess("ads")
        // 1. Delete from Cloudinary
        if (publicId) {
            await cloudinary.uploader.destroy(publicId, { resource_type: mediaType })
        }

        // 2. Delete from Database
        const supabase = access.supabase
        const { error } = await supabase.from("ads").delete().eq("id", id)

        if (error) throw error

        revalidatePath("/dashboard/ads")
        return { success: true }
    } catch (error) {
        console.error("Error deleting ad:", error)
        return { error: "Failed to delete ad" }
    }
}

export async function toggleAdStatus(id: string, currentStatus: boolean) {
    const access = await requireAdminRouteAccess("ads")
    const supabase = access.supabase
    const { error } = await supabase
        .from("ads")
        .update({ is_active: !currentStatus })
        .eq("id", id)

    if (error) {
        console.error("Error updating ad status:", error)
        return { error: "Failed to update status" }
    }

    revalidatePath("/dashboard/ads")
    return { success: true }
}
