"use server"

import cloudinary from "@/lib/cloudinary"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

type CloudinaryResourceType = "image" | "video"
type AdminDiscountBundleUploadTarget = "bundle-card" | "page-hero"

function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "asset"
}

function buildPublicId(prefix: string, fileName: string) {
    return `${prefix}-${Date.now()}-${sanitizeFileName(fileName)}`
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

async function requireAdminUser() {
    await requireAdminRouteAccess("discount_bundles")
}

function signUpload(folder: string, publicId: string, apiSecret: string) {
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
        publicId,
        signature,
        timestamp,
    }
}

export async function createAdminDiscountBundleUploadSignature(
    fileName: string,
    resourceType: CloudinaryResourceType,
    target: AdminDiscountBundleUploadTarget
) {
    await requireAdminUser()
    const { apiKey, apiSecret, cloudName } = getUploadConfig()

    const folder =
        target === "page-hero"
            ? "rssa1/marketing/discount-bundles/page"
            : "rssa1/marketing/discount-bundles/cards"
    const prefix =
        target === "page-hero"
            ? "discount-bundles-page"
            : "discount-bundle-card"
    const { publicId, signature, timestamp } = signUpload(
        folder,
        buildPublicId(prefix, fileName),
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

export async function deleteDiscountBundleCloudinaryAsset(publicId: string, resourceType: CloudinaryResourceType) {
    if (!publicId) {
        return
    }

    await requireAdminUser()

    await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: resourceType,
    })
}
