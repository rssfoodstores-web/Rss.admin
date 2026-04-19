"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SocialMediaLink } from "@/types/social-media"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const SOCIAL_PLATFORMS = [
    "Facebook",
    "Instagram",
    "Twitter / X",
    "LinkedIn",
    "YouTube",
    "TikTok",
    "Pinterest",
    "Snapchat",
    "WhatsApp",
    "Telegram",
    "Discord",
    "Reddit",
    "Threads",
    "Other"
]

const formSchema = z
    .object({
        custom_platform: z.string().trim().optional(),
        is_active: z.boolean(),
        platform: z.string().min(1, "Please select a platform"),
        url: z.string().trim().url("Please enter a valid URL"),
    })
    .superRefine((value, ctx) => {
        if (value.platform === "Other" && !value.custom_platform?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter a custom platform name.",
                path: ["custom_platform"],
            })
        }
    })

type FormData = z.infer<typeof formSchema>

interface SocialMediaFormProps {
    initialData?: SocialMediaLink
    onSuccess?: () => void
}

export function SocialMediaForm({ initialData, onSuccess }: SocialMediaFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const supabase = createClient()
    const initialPlatform = initialData?.platform && SOCIAL_PLATFORMS.includes(initialData.platform)
        ? initialData.platform
        : initialData?.platform
            ? "Other"
            : ""

    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            custom_platform: initialPlatform === "Other" ? initialData?.platform || "" : "",
            platform: initialPlatform,
            url: initialData?.url || "",
            is_active: initialData?.is_active ?? true,
        },
    })
    const selectedPlatform = watch("platform")

    const onSubmit = async (data: FormData) => {
        setIsLoading(true)
        try {
            const platform = data.platform === "Other"
                ? data.custom_platform?.trim() ?? ""
                : data.platform.trim()

            if (initialData) {
                const { error } = await supabase
                    .from("social_media_links")
                    .update({
                        platform,
                        url: data.url.trim(),
                        is_active: data.is_active,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", initialData.id)

                if (error) throw error
                toast({
                    title: "Success",
                    description: "Social media link updated successfully.",
                })
            } else {
                const { error } = await supabase
                    .from("social_media_links")
                    .insert({
                        platform,
                        url: data.url.trim(),
                        is_active: data.is_active,
                    })

                if (error) throw error
                toast({
                    title: "Success",
                    description: "Social media link created successfully.",
                })
            }
            onSuccess?.()
        } catch (error: unknown) {
            const description = error instanceof Error ? error.message : "Something went wrong."
            toast({
                title: "Error",
                description,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Controller
                    control={control}
                    name="platform"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent>
                                {SOCIAL_PLATFORMS.map((platform) => (
                                    <SelectItem key={platform} value={platform}>
                                        {platform}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.platform && (
                    <p className="text-sm text-red-500">{errors.platform.message}</p>
                )}
            </div>

            {selectedPlatform === "Other" ? (
                <div className="space-y-2">
                    <Label htmlFor="custom_platform">Custom platform name</Label>
                    <Input
                        id="custom_platform"
                        placeholder="e.g. Threads, Snapchat, Blog"
                        {...register("custom_platform")}
                    />
                    {errors.custom_platform && (
                        <p className="text-sm text-red-500">{errors.custom_platform.message}</p>
                    )}
                </div>
            ) : null}

            <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                    id="url"
                    placeholder="e.g. https://linkedin.com/in/..."
                    {...register("url")}
                />
                {errors.url && (
                    <p className="text-sm text-red-500">{errors.url.message}</p>
                )}
            </div>

            <div className="flex items-center space-x-2">
                <Controller
                    control={control}
                    name="is_active"
                    render={({ field }) => (
                        <Checkbox
                            id="is_active"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
                <Label htmlFor="is_active">Active</Label>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? "Update Link" : "Add Link"}
            </Button>
        </form>
    )
}
