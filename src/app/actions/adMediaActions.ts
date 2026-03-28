"use server"

import cloudinary from "@/lib/cloudinary"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

type CloudinaryResourceType = "image" | "video"

function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "asset"
}

function buildPublicId(fileName: string) {
    return `ad-campaign-${Date.now()}-${sanitizeFileName(fileName)}`
}

function getUploadConfig() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary media upload is not configured.")
    }

    return {
        apiKey,
        apiSecret,
        cloudName,
    }
}

export async function createAdminAdUploadSignature(
    fileName: string,
    resourceType: CloudinaryResourceType
) {
    await requireAdminRouteAccess("ads")
    const { apiKey, apiSecret, cloudName } = getUploadConfig()

    const folder = "rssa1/marketing/ads"
    const publicId = buildPublicId(fileName)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = cloudinary.utils.api_sign_request(
        {
            folder,
            public_id: publicId,
            timestamp,
        },
        apiSecret
    )

    return {
        apiKey,
        cloudName,
        folder,
        publicId,
        resourceType,
        signature,
        timestamp,
    }
}

export async function deleteAdCloudinaryAsset(publicId: string, resourceType: CloudinaryResourceType) {
    if (!publicId) {
        return
    }

    await requireAdminRouteAccess("ads")

    await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: resourceType,
    })
}
