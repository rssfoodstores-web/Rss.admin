"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { GoogleIdentityButton } from "@/components/auth/GoogleIdentityButton"

export function LoginForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<"div">) {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleGoogleAuthenticated = async () => {
        window.location.assign("/dashboard")
    }

    const handleGoogleError = (message: string) => {
        toast({
            variant: "destructive",
            title: "Google Sign-in Failed",
            description: message,
        })
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        })

        if (error) {
            setLoading(false)
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: error.message
            })
        } else {
            router.push("/dashboard")
        }
    }


    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="p-0 pb-6 text-center md:text-left">
                    <div className="flex justify-center md:justify-start mb-6">
                        {/* Logo */}
                        <div className="flex flex-col items-center">
                            <div className="relative mb-2 h-28 w-48">
                                <Image
                                    src="/rss-foods-admin-login-logo.png"
                                    alt="RSS Foods Logo"
                                    fill
                                    className="object-contain"
                                    sizes="192px"
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold">Login as an admin</CardTitle>
                    <CardDescription className="sr-only">
                        Login to access the admin dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <form onSubmit={handleLogin}>
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="relative">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative mt-2">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="pr-10"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="remember" />
                                    <label
                                        htmlFor="remember"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                                    >
                                        Remember me
                                    </label>
                                </div>
                                <Link
                                    href="#"
                                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-muted-foreground"
                                >
                                    Forget Password
                                </Link>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full bg-[#EA7C24] hover:bg-[#D66B1A] text-white">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Login to Admin Dashboard
                            </Button>

                            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                                    Or continue with
                                </span>
                            </div>
                            <GoogleIdentityButton
                                disabled={loading}
                                onAuthenticated={handleGoogleAuthenticated}
                                onError={handleGoogleError}
                            />

                            <div className="text-center text-sm text-muted-foreground mt-4">
                                Need any help? <Link href="#" className="font-semibold text-foreground hover:underline">Contact Support</Link>
                            </div>

                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
