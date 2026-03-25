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

const formSchema = z.object({
    platform: z.string().min(1, "Please select a platform"),
    url: z.string().url("Please enter a valid URL"),
    is_active: z.boolean(),
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

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            platform: initialData?.platform || "",
            url: initialData?.url || "",
            is_active: initialData?.is_active ?? true,
        },
    })

    const onSubmit = async (data: FormData) => {
        setIsLoading(true)
        try {
            if (initialData) {
                const { error } = await supabase
                    .from("social_media_links")
                    .update({
                        platform: data.platform,
                        url: data.url,
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
                        platform: data.platform,
                        url: data.url,
                        is_active: data.is_active,
                    })

                if (error) throw error
                toast({
                    title: "Success",
                    description: "Social media link created successfully.",
                })
            }
            onSuccess?.()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Something went wrong.",
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
