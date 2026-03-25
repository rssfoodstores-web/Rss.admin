import { requireAdminRouteAccess } from "@/lib/admin-auth"

export default async function MessagesPage() {
    await requireAdminRouteAccess("messages")
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-muted-foreground">Communication center.</p>
        </div>
    )
}
