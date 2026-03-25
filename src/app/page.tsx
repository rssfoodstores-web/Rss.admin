import { LoginForm } from "@/components/login-form"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10 relative">
                <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
                    {/* Mobile Theme Toggle can go here or be part of a header if needed */}
                </div>

                <div className="absolute top-6 right-6 md:top-10 md:right-10 z-10">
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <LoginForm />
                    </div>
                </div>
            </div>
            <div className="relative hidden lg:flex flex-col items-center justify-center bg-zinc-950 p-10 text-white dark:border-r lg:border-l border-zinc-800">
                <div className="absolute inset-0 bg-zinc-900" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea7c2410_1px,transparent_1px),linear-gradient(to_bottom,#ea7c2410_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
                <div className="relative z-20 flex flex-col items-center gap-6 text-center">
                    <div className="rounded-2xl bg-zinc-900/50 p-4 ring-1 ring-white/10 backdrop-blur-xl">
                        <Image
                            src="/rss-foods-logo-new.png"
                            alt="RSS Foods Logo"
                            width={160}
                            height={160}
                            className="h-20 w-auto object-contain"
                            priority
                        />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Welcome Back
                        </h1>
                        <p className="text-zinc-400 max-w-sm">
                            Enter your credentials to access the RSS Foods administration dashboard.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
