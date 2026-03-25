"use client"

import { useMemo, useState, useTransition } from "react"
import { ShieldCheck, ShieldAlert, UserPlus, Search, Lock, Save, UserCog } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { saveAdminAccess, type AdminManagementPageData, type ManagedAdminRecord } from "./actions"

interface AdminManagementClientProps {
    initialData: AdminManagementPageData
}

type EditableRole = "admin" | "sub_admin" | "none"

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
}

function AdminRoleBadge({ role }: { role: ManagedAdminRecord["role"] }) {
    if (role === "supa_admin") {
        return (
            <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                Super Admin
            </Badge>
        )
    }

    if (role === "admin") {
        return (
            <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600">
                <ShieldCheck className="h-3 w-3" />
                Admin
            </Badge>
        )
    }

    return (
        <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
            <UserCog className="h-3 w-3" />
            Sub Admin
        </Badge>
    )
}

function formatPermissionLabel(count: number) {
    if (count === 0) {
        return "No pages assigned"
    }

    return `${count} page${count === 1 ? "" : "s"} assigned`
}

export function AdminManagementClient({ initialData }: AdminManagementClientProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [selectedUserId, setSelectedUserId] = useState<string>("")
    const [selectedRole, setSelectedRole] = useState<EditableRole>("sub_admin")
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

    const users = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()

        if (!normalizedQuery) {
            return initialData.users
        }

        return initialData.users.filter((user) => {
            const haystack = [
                user.fullName,
                user.companyName ?? "",
                user.phone ?? "",
                user.roleSummary,
            ].join(" ").toLowerCase()

            return haystack.includes(normalizedQuery)
        })
    }, [initialData.users, query])

    const selectedUser = useMemo(
        () => initialData.users.find((user) => user.id === selectedUserId) ?? null,
        [initialData.users, selectedUserId]
    )

    function openForCreate() {
        setSelectedUserId("")
        setSelectedRole("sub_admin")
        setSelectedPermissions([])
        setQuery("")
        setIsDialogOpen(true)
    }

    function openForEdit(admin: ManagedAdminRecord) {
        setSelectedUserId(admin.id)
        setSelectedRole(admin.role === "supa_admin" ? "admin" : admin.role)
        setSelectedPermissions(admin.role === "sub_admin" ? admin.permissionKeys : [])
        setQuery(admin.fullName)
        setIsDialogOpen(true)
    }

    function togglePermission(permissionKey: string, checked: boolean) {
        setSelectedPermissions((current) => {
            if (checked) {
                return Array.from(new Set([...current, permissionKey]))
            }

            return current.filter((key) => key !== permissionKey)
        })
    }

    function handleSave() {
        startTransition(async () => {
            const result = await saveAdminAccess({
                permissionKeys: selectedRole === "sub_admin" ? selectedPermissions : [],
                role: selectedRole,
                userId: selectedUserId,
            })

            if (result.error) {
                toast({
                    title: "Access update failed",
                    description: result.error,
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "Access updated",
                description: selectedRole === "none"
                    ? "Admin dashboard access was removed."
                    : selectedRole === "admin"
                        ? "User now has full admin dashboard access."
                        : "Sub-admin access was updated successfully.",
            })
            setIsDialogOpen(false)
            router.refresh()
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Management</h1>
                    <p className="text-muted-foreground">
                        Promote users to full admin or sub-admin and control exactly which dashboard pages each sub-admin can use.
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openForCreate} className="bg-orange-500 text-white hover:bg-orange-600">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Grant admin access
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Manage dashboard access</DialogTitle>
                            <DialogDescription>
                                Choose a user, set their admin level, and assign page access when the role is sub-admin.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="admin-user-search">Find user</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="admin-user-search"
                                            placeholder="Search name, company, phone, or role"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <ScrollArea className="h-72 rounded-xl border">
                                    <div className="divide-y">
                                        {users.map((user) => {
                                            const isSelected = user.id === selectedUserId

                                            return (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUserId(user.id)
                                                        setQuery(user.fullName)
                                                    }}
                                                    className={`flex w-full items-start gap-3 p-4 text-left transition ${isSelected ? "bg-orange-50 dark:bg-orange-950/20" : "hover:bg-muted/50"}`}
                                                >
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={user.avatarUrl ?? undefined} />
                                                        <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-semibold">{user.fullName}</p>
                                                        <p className="truncate text-sm text-muted-foreground">
                                                            {user.companyName || user.phone || "No extra profile info"}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                                                            {user.roleSummary.replace(/_/g, " ")}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="space-y-5">
                                <div className="rounded-2xl border p-4">
                                    <Label className="text-sm font-medium">Selected user</Label>
                                    {selectedUser ? (
                                        <div className="mt-3 flex items-center gap-3">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage src={selectedUser.avatarUrl ?? undefined} />
                                                <AvatarFallback>{getInitials(selectedUser.fullName)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{selectedUser.fullName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {selectedUser.companyName || selectedUser.phone || "Profile selected"}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-muted-foreground">Pick a user from the list before saving access.</p>
                                    )}
                                </div>

                                <div className="rounded-2xl border p-4">
                                    <Label className="text-sm font-medium">Admin level</Label>
                                    <div className="mt-3 space-y-3">
                                        {[
                                            {
                                                description: "Full access across the admin dashboard.",
                                                label: "Admin",
                                                value: "admin" as const,
                                            },
                                            {
                                                description: "Restricted access based on the pages you assign below.",
                                                label: "Sub Admin",
                                                value: "sub_admin" as const,
                                            },
                                            {
                                                description: "Remove dashboard access completely.",
                                                label: "No admin access",
                                                value: "none" as const,
                                            },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setSelectedRole(option.value)}
                                                className={`w-full rounded-xl border p-3 text-left transition ${selectedRole === option.value ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "hover:border-orange-200"}`}
                                            >
                                                <div className="font-medium">{option.label}</div>
                                                <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <Label className="text-sm font-medium">Allowed pages</Label>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                If a sub-admin has no pages selected, they will have no usable dashboard access.
                                            </p>
                                        </div>
                                        {selectedRole !== "sub_admin" ? (
                                            <Badge variant="outline" className="gap-1">
                                                <Lock className="h-3 w-3" />
                                                Full access
                                            </Badge>
                                        ) : null}
                                    </div>

                                    <Separator className="my-4" />

                                    <div className={`space-y-3 ${selectedRole !== "sub_admin" ? "opacity-50" : ""}`}>
                                        {initialData.assignablePermissions.map((permission) => (
                                            <label key={permission.key} className="flex items-start gap-3 rounded-xl border p-3">
                                                <Checkbox
                                                    checked={selectedPermissions.includes(permission.key)}
                                                    disabled={selectedRole !== "sub_admin"}
                                                    onCheckedChange={(checked) => togglePermission(permission.key, checked === true)}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-medium">{permission.title}</p>
                                                    <p className="text-sm text-muted-foreground">{permission.href}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSave} disabled={isPending || !selectedUserId} className="bg-orange-500 text-white hover:bg-orange-600">
                                        <Save className="mr-2 h-4 w-4" />
                                        {isPending ? "Saving..." : "Save access"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Total admins</CardTitle>
                        <CardDescription>Full admins and sub-admins currently active.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{initialData.admins.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Sub-admins</CardTitle>
                        <CardDescription>Restricted dashboard users controlled by permissions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {initialData.admins.filter((admin) => admin.role === "sub_admin").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Actor level</CardTitle>
                        <CardDescription>Your current authority inside this workspace.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Badge variant={initialData.currentRole === "supa_admin" ? "destructive" : "outline"}>
                            {initialData.currentRole === "supa_admin" ? "Super Admin" : "Admin"}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Administrators</CardTitle>
                    <CardDescription>
                        Super admins stay read-only here. Admins have full dashboard access. Sub-admins only see the pages assigned to them.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {initialData.admins.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                            No admin accounts are available yet.
                        </div>
                    ) : (
                        initialData.admins.map((admin) => (
                            <div key={admin.id} className="rounded-2xl border p-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={admin.avatarUrl ?? undefined} />
                                            <AvatarFallback>{getInitials(admin.fullName)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold">{admin.fullName}</p>
                                                <AdminRoleBadge role={admin.role} />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {admin.companyName || admin.phone || "No extra profile info"}
                                            </p>
                                        </div>
                                    </div>

                                    {admin.role !== "supa_admin" ? (
                                        <Button variant="outline" onClick={() => openForEdit(admin)}>
                                            Edit access
                                        </Button>
                                    ) : (
                                        <Badge variant="outline">Protected</Badge>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {admin.role === "sub_admin" ? (
                                        <>
                                            <Badge variant="secondary">
                                                {formatPermissionLabel(admin.permissionKeys.length)}
                                            </Badge>
                                            {admin.permissionKeys.length > 0 ? (
                                                initialData.assignablePermissions
                                                    .filter((permission) => admin.permissionKeys.includes(permission.key))
                                                    .map((permission) => (
                                                        <Badge key={permission.key} variant="outline" className="capitalize">
                                                            {permission.title}
                                                        </Badge>
                                                    ))
                                            ) : null}
                                        </>
                                    ) : (
                                        <Badge variant="secondary">Full dashboard access</Badge>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
