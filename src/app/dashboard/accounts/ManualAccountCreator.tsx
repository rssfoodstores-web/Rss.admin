"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Eye, EyeOff, KeyRound, Mail, Phone, Save, ShieldCheck, UserPlus } from "lucide-react"
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
import type { ManualAccountRole } from "./roles"

interface ManualAccountCreatorProps {
    canCreateAdminRoles: boolean
}

type ManualAccountIdentifierType = "email" | "phone"

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

const PASSWORD_GROUPS = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
] as const

const PASSWORD_ALPHABET = PASSWORD_GROUPS.join("")
const GENERATED_PASSWORD_LENGTH = 16

function getSecureRandomIndex(maxExclusive: number) {
    const range = 0x100000000
    const unbiasedLimit = Math.floor(range / maxExclusive) * maxExclusive
    const randomValue = new Uint32Array(1)

    do {
        crypto.getRandomValues(randomValue)
    } while (randomValue[0] >= unbiasedLimit)

    return randomValue[0] % maxExclusive
}

function generatePassword() {
    const characters = PASSWORD_GROUPS.map((group) => group[getSecureRandomIndex(group.length)])

    while (characters.length < GENERATED_PASSWORD_LENGTH) {
        characters.push(PASSWORD_ALPHABET[getSecureRandomIndex(PASSWORD_ALPHABET.length)])
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
        const swapIndex = getSecureRandomIndex(index + 1)
        const currentCharacter = characters[index]
        characters[index] = characters[swapIndex]
        characters[swapIndex] = currentCharacter
    }

    return characters.join("")
}

function getCredentialLabel(identifierType: ManualAccountIdentifierType) {
    return identifierType === "phone" ? "Phone" : "Email"
}

export function ManualAccountCreator({ canCreateAdminRoles }: ManualAccountCreatorProps) {
    const router = useRouter()
    const { toast } = useToast()
    const submissionLockRef = useRef(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [identifierType, setIdentifierType] = useState<ManualAccountIdentifierType>("email")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [fullName, setFullName] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState<ManualAccountRole>("customer")
    const [grantAccountsPageAccess, setGrantAccountsPageAccess] = useState(true)
    const [grantAccountInfoPageAccess, setGrantAccountInfoPageAccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [passwordGenerated, setPasswordGenerated] = useState(false)
    const [createdCredentials, setCreatedCredentials] = useState<{
        identifier: string
        identifierType: ManualAccountIdentifierType
        password: string
        passwordGenerated: boolean
        role: ManualAccountRole
    } | null>(null)

    const roleOptions = useMemo(
        () => canCreateAdminRoles ? [...regularRoleOptions, ...adminRoleOptions] : regularRoleOptions,
        [canCreateAdminRoles]
    )
    const identifierValue = identifierType === "phone" ? phone : email

    function copyCredentials() {
        if (!createdCredentials) {
            return
        }

        const message = [
            "Your RSS Foods account has been created.",
            `${getCredentialLabel(createdCredentials.identifierType)}: ${createdCredentials.identifier}`,
            `Password: ${createdCredentials.password}`,
        ].join("\n")

        navigator.clipboard.writeText(message)
        toast({
            title: "Credentials copied",
            description: "Login details are ready to send.",
        })
    }

    async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (submissionLockRef.current) {
            return
        }

        submissionLockRef.current = true
        setIsSubmitting(true)
        const submittedPassword = password

        try {
            const response = await fetch("/dashboard/accounts/create", {
                body: JSON.stringify({
                    email,
                    fullName,
                    grantAccountInfoPageAccess: role === "sub_admin" && grantAccountInfoPageAccess,
                    grantAccountsPageAccess: role === "sub_admin" && grantAccountsPageAccess,
                    identifierType,
                    password: submittedPassword,
                    passwordGenerated,
                    phone,
                    role,
                }),
                headers: {
                    "Content-Type": "application/json",
                },
                method: "POST",
            })
            const result = await response.json().catch(() => null) as {
                createdUser?: {
                    email?: string
                    identifierType: ManualAccountIdentifierType
                    passwordGenerated: boolean
                    phone?: string
                    role: ManualAccountRole
                }
                error?: string
                warning?: string
            } | null

            const createdIdentifier = result?.createdUser?.identifierType === "phone"
                ? result.createdUser.phone
                : result?.createdUser?.email

            if (!response.ok || result?.error || !result?.createdUser || !createdIdentifier) {
                throw new Error(result?.error ?? "The account service returned an invalid response.")
            }

            setCreatedCredentials({
                identifier: createdIdentifier,
                identifierType: result.createdUser.identifierType,
                password: submittedPassword,
                passwordGenerated: result.createdUser.passwordGenerated,
                role: result.createdUser.role,
            })
            setEmail("")
            setPhone("")
            setFullName("")
            setPassword("")
            setPasswordGenerated(false)
            setRole("customer")
            setGrantAccountsPageAccess(true)
            setGrantAccountInfoPageAccess(false)
            toast({
                title: "Account created",
                description: result.warning ?? `${createdIdentifier} is registered and ready to sign in.`,
            })
            router.refresh()
        } catch (error) {
            toast({
                title: "Account creation failed",
                description: error instanceof Error ? error.message : "The account could not be created.",
                variant: "destructive",
            })
        } finally {
            submissionLockRef.current = false
            setIsSubmitting(false)
        }
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
                        <CardDescription>Email, phone, or role-based account with a password.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateAccount}>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Sign-in method</Label>
                        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-1">
                            <Button
                                className="justify-center"
                                onClick={() => setIdentifierType("email")}
                                type="button"
                                variant={identifierType === "email" ? "default" : "ghost"}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Email
                            </Button>
                            <Button
                                className="justify-center"
                                onClick={() => setIdentifierType("phone")}
                                type="button"
                                variant={identifierType === "phone" ? "default" : "ghost"}
                            >
                                <Phone className="mr-2 h-4 w-4" />
                                Phone
                            </Button>
                        </div>
                    </div>

                    {identifierType === "phone" ? (
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="manual-account-phone">Phone number</Label>
                            <Input
                                id="manual-account-phone"
                                autoComplete="off"
                                inputMode="tel"
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="0803 123 4567"
                                type="tel"
                                value={phone}
                            />
                        </div>
                    ) : (
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
                    )}

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
                                    onChange={(event) => {
                                        setPassword(event.target.value)
                                        setPasswordGenerated(false)
                                    }}
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
                                    setPasswordGenerated(true)
                                    setShowPassword(true)
                                }}
                                type="button"
                                variant="outline"
                            >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Generate
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Generated passwords always include uppercase and lowercase letters, a number, and a symbol.
                        </p>
                    </div>

                    {role === "sub_admin" ? (
                        <div className="space-y-3 md:col-span-2">
                            <label className="flex items-start gap-3 rounded-md border p-3">
                                <Checkbox
                                    checked={grantAccountsPageAccess}
                                    onCheckedChange={(checked) => setGrantAccountsPageAccess(checked === true)}
                                />
                                <span className="space-y-1">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <ShieldCheck className="h-4 w-4 text-orange-500" />
                                        Add Users page access
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        Let this sub-admin create user accounts after signing in.
                                    </span>
                                </span>
                            </label>
                            <label className="flex items-start gap-3 rounded-md border p-3">
                                <Checkbox
                                    checked={grantAccountInfoPageAccess}
                                    onCheckedChange={(checked) => setGrantAccountInfoPageAccess(checked === true)}
                                />
                                <span className="space-y-1">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <ShieldCheck className="h-4 w-4 text-orange-500" />
                                        Account Info page access
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        Let this sub-admin view the account table and user profile details.
                                    </span>
                                </span>
                            </label>
                        </div>
                    ) : null}

                    <div className="md:col-span-2">
                        <Button
                            className="bg-orange-500 text-white hover:bg-orange-600"
                            disabled={isSubmitting || !identifierValue.trim() || password.length < 6}
                            type="submit"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Creating and verifying..." : "Create account"}
                        </Button>
                    </div>
                </form>

                <div className="rounded-md border bg-muted/20 p-4">
                    <div className="text-sm font-medium">Latest credentials</div>
                    {createdCredentials ? (
                        <div className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground">
                                    {getCredentialLabel(createdCredentials.identifierType)}
                                </div>
                                <div className="break-all font-medium">{createdCredentials.identifier}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground">Password</div>
                                <div className="break-all font-mono text-sm">{createdCredentials.password}</div>
                                <div className="text-xs text-muted-foreground">
                                    {createdCredentials.passwordGenerated ? "Securely generated" : "Entered by the administrator"}
                                </div>
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
