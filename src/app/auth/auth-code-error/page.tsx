import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface AuthCodeErrorPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AuthCodeErrorPage({ searchParams }: AuthCodeErrorPageProps) {
    const params = await searchParams
    const error = typeof params.error === "string" ? params.error : "There was a problem signing you in."
    const errorCode = typeof params.error_code === "string" ? params.error_code : null
    const expired = error.toLowerCase().includes("expired") || errorCode?.toLowerCase().includes("expired")

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm text-center">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-destructive">Authentication Error</CardTitle>
                    <CardDescription>
                        {expired ? "This sign-in link has expired." : "We could not complete the secure sign-in."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Please return to the admin login page and try again.
                    </p>
                    <Button asChild className="w-full">
                        <Link href="/">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
