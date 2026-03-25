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

export function LoginForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<"div">) {
    const [showPassword, setShowPassword] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleGoogleLogin = async () => {
        try {
            setGoogleLoading(true)
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            })
            if (error) {
                console.error("Google login error:", error)
                toast({
                    variant: "destructive",
                    title: "Action Error",
                    description: error.message
                })
            }
        } catch (error) {
            console.error("Unexpected error:", error)
            toast({
                variant: "destructive",
                title: "Action Error",
                description: "An unexpected error occurred"
            })
        } finally {
            // We don't set loading to false immediately because of the redirect
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email,
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
                            <div className="relative w-40 h-20 mb-2">
                                <Image
                                    src="/rss-foods-logo-new.png"
                                    alt="RSS Foods Logo"
                                    fill
                                    className="object-contain"
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
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleGoogleLogin}
                                disabled={googleLoading}
                                type="button"
                            >
                                {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-5 mr-2">
                                        <path
                                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.1-1.147 8.027-3.147 2.053-1.92 3.627-4.667 3.627-7.84 0-.667-.107-1.44-.133-1.947H12.48z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                )}
                                Sign in with Google
                            </Button>

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
