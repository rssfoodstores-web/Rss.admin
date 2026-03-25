import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAdminAccessDeniedContext, getAdminAccessContext } from "@/lib/admin-auth"
import { getDefaultAdminRouteHref } from "@/lib/admin-routes"

interface AccessDeniedPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
    const access = await getAdminAccessContext()
    const params = await searchParams
    const from = typeof params.from === "string" ? params.from : null
    const denied = getAdminAccessDeniedContext(from)
    const defaultHref = getDefaultAdminRouteHref(access)
    const fallbackHref = defaultHref.startsWith("/dashboard/") ? defaultHref : "/"

    return (
        <div className="mx-auto max-w-2xl">
            <Card className="border-orange-100 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle>Access restricted</CardTitle>
                    <CardDescription>
                        You do not currently have permission to open {denied.requestedTitle}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Ask a full admin to update your dashboard access. If no pages were assigned yet, your account will stay locked out of the dashboard areas until permissions are granted.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
                            <Link href={fallbackHref}>Open allowed area</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/">Back to login</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
