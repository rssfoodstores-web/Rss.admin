"use client"

import { useMemo, useState, useTransition } from "react"
import { Copy, Eye, EyeOff, KeyRound, Save, ShieldCheck, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createManualAccount, type ManualAccountRole } from "./actions"

interface ManualAccountCreatorProps {
    canCreateAdminRoles: boolean
}

const regularRoleOptions: Array<{ label: string; value: ManualAccountRole }> = [
    { label: "Customer", value: "customer" },
    { label: "Merchant", value: "merchant" },
    { label: "Rider", value: "rider" },
    { label: "Agent", value: "agent" },
]

const adminRoleOptions: Array<{ label: string; value: ManualAccountRole }> = [
    { label: "Admin", value: "admin" },
    { label: "Sub Admin", value: "sub_admin" },
]

function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
    const bytes = new Uint32Array(14)
    crypto.getRandomValues(bytes)

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

export function ManualAccountCreator({ canCreateAdminRoles }: ManualAccountCreatorProps) {
    const { toast } = useToast()
    const [isPending, startTransition] = useTransition()
    const [email, setEmail] = useState("")
    const [fullName, setFullName] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState<ManualAccountRole>("customer")
    const [grantAccountsPageAccess, setGrantAccountsPageAccess] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [createdCredentials, setCreatedCredentials] = useState<{
        email: string
        password: string
        role: ManualAccountRole
    } | null>(null)

    const roleOptions = useMemo(
        () => canCreateAdminRoles ? [...regularRoleOptions, ...adminRoleOptions] : regularRoleOptions,
        [canCreateAdminRoles]
    )

    function copyCredentials() {
        if (!createdCredentials) {
            return
        }

        const message = [
            "Your RSS Foods account has been created.",
            `Email: ${createdCredentials.email}`,
            `Password: ${createdCredentials.password}`,
        ].join("\n")

        navigator.clipboard.writeText(message)
        toast({
            title: "Credentials copied",
            description: "Login details are ready to send.",
        })
    }

    function handleCreateAccount() {
        const submittedPassword = password

        startTransition(async () => {
            const result = await createManualAccount({
                email,
                fullName,
                grantAccountsPageAccess: role === "sub_admin" && grantAccountsPageAccess,
                password: submittedPassword,
                role,
            })

            if (result.error || !result.createdUser) {
                toast({
                    title: "Account creation failed",
                    description: result.error ?? "The account could not be created.",
                    variant: "destructive",
                })
                return
            }

            setCreatedCredentials({
                email: result.createdUser.email,
                password: submittedPassword,
                role: result.createdUser.role,
            })
            setEmail("")
            setFullName("")
            setPassword("")
            setRole("customer")
            setGrantAccountsPageAccess(true)
            toast({
                title: "Account created",
                description: `${result.createdUser.email} can now sign in.`,
            })
        })
    }

    return (
        <Card className="border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500 text-white">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle>Create user account</CardTitle>
                        <CardDescription>Email-confirmed account with a selected role.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="manual-account-email">Email</Label>
                        <Input
                            id="manual-account-email"
                            autoComplete="off"
                            inputMode="email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="user@example.com"
                            type="email"
                            value={email}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="manual-account-name">Display name</Label>
                        <Input
                            id="manual-account-name"
                            autoComplete="off"
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Optional"
                            value={fullName}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="manual-account-role">Role</Label>
                        <Select value={role} onValueChange={(value) => setRole(value as ManualAccountRole)}>
                            <SelectTrigger id="manual-account-role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="manual-account-password">Password</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                                <Input
                                    id="manual-account-password"
                                    autoComplete="new-password"
                                    className="pr-10"
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Minimum 6 characters"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                />
                                <Button
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-1 top-1 h-7 w-7"
                                    onClick={() => setShowPassword((current) => !current)}
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Button
                                onClick={() => {
                                    setPassword(generatePassword())
                                    setShowPassword(true)
                                }}
                                type="button"
                                variant="outline"
                            >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Generate
                            </Button>
                        </div>
                    </div>

                    {role === "sub_admin" ? (
                        <label className="flex items-start gap-3 rounded-md border p-3 md:col-span-2">
                            <Checkbox
                                checked={grantAccountsPageAccess}
                                onCheckedChange={(checked) => setGrantAccountsPageAccess(checked === true)}
                            />
                            <span className="space-y-1">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <ShieldCheck className="h-4 w-4 text-orange-500" />
                                    Accounts page access
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    Let this sub-admin open this page after signing in.
                                </span>
                            </span>
                        </label>
                    ) : null}

                    <div className="md:col-span-2">
                        <Button
                            className="bg-orange-500 text-white hover:bg-orange-600"
                            disabled={isPending || !email || !password}
                            onClick={handleCreateAccount}
                            type="button"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isPending ? "Creating..." : "Create account"}
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-4">
                    <div className="text-sm font-medium">Latest credentials</div>
                    {createdCredentials ? (
                        <div className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground">Email</div>
                                <div className="break-all font-medium">{createdCredentials.email}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground">Password</div>
                                <div className="break-all font-mono text-sm">{createdCredentials.password}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground">Role</div>
                                <div className="capitalize">{createdCredentials.role.replace("_", " ")}</div>
                            </div>
                            <Button onClick={copyCredentials} type="button" variant="outline">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy login details
                            </Button>
                        </div>
                    ) : (
                        <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                            Newly created login details will appear here.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
