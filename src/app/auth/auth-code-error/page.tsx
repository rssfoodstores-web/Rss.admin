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
    const errorDescription = typeof params.error_description === "string" ? params.error_description : null
    const callbackUrl = typeof params.callback_url === "string" ? params.callback_url : null

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm text-center">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-destructive">Authentication Error</CardTitle>
                    <CardDescription>
                        {error}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {errorDescription ?? "This could be due to an expired link, a network issue, or an OAuth callback mismatch."}
                    </p>
                    {errorCode && (
                        <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                            {errorCode}
                        </p>
                    )}
                    {callbackUrl && (
                        <div className="rounded-md border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                            <p className="font-semibold text-foreground">Allowlist this callback URL in Supabase Auth</p>
                            <p className="mt-2 break-all font-mono">{callbackUrl}</p>
                        </div>
                    )}
                    <Button asChild className="w-full">
                        <Link href="/">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
