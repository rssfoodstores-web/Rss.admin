"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
    CalendarClock,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Eye,
    KeyRound,
    Mail,
    Phone,
    Search,
    ShieldCheck,
    UserRound,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatDateTime, labelize, shortId } from "@/lib/admin-display"
import type { ManualCreatedAccountRecord } from "@/types/manual-accounts"

interface CreatedAccountsDirectoryProps {
    accounts: ManualCreatedAccountRecord[]
    canViewFullProfiles: boolean
    errorMessage: string | null
}

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U"
}

function getIdentifier(account: ManualCreatedAccountRecord) {
    return account.identifierType === "phone"
        ? account.phone ?? "No phone saved"
        : account.email ?? "No email saved"
}

export function CreatedAccountsDirectory({
    accounts,
    canViewFullProfiles,
    errorMessage,
}: CreatedAccountsDirectoryProps) {
    const [query, setQuery] = useState("")
    const [selectedAccount, setSelectedAccount] = useState<ManualCreatedAccountRecord | null>(null)
    const filteredAccounts = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()

        if (!normalizedQuery) {
            return accounts
        }

        return accounts.filter((account) => [
            account.fullName,
            account.email,
            account.phone,
            account.requestedRole,
            ...account.roles,
            account.userId,
            account.createdByName,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery)))
    }, [accounts, query])
    const signedInCount = accounts.filter((account) => account.lastSignInAt).length
    const generatedPasswordCount = accounts.filter((account) => account.passwordSource === "generated").length

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Accounts created</CardTitle>
                        <UserRound className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{accounts.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Have signed in</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{signedInCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Generated passwords tracked</CardTitle>
                        <KeyRound className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{generatedPasswordCount}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Tracking starts with this update.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Created account directory</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Search accounts created from the Add Users page. Passwords are never stored here.
                        </p>
                    </div>
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search name, email, phone, role, or ID"
                            value={query}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {errorMessage ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                            {errorMessage}
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                            {query ? "No created accounts match this search." : "No accounts have been recorded from this method yet."}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Login</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAccounts.map((account) => (
                                    <TableRow key={account.userId}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={account.avatarUrl ?? undefined} />
                                                    <AvatarFallback>{getInitials(account.fullName)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{account.fullName}</div>
                                                    <div className="font-mono text-xs text-muted-foreground">{shortId(account.userId, 10)}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {account.identifierType === "phone"
                                                    ? <Phone className="h-4 w-4 text-muted-foreground" />
                                                    : <Mail className="h-4 w-4 text-muted-foreground" />}
                                                <span>{getIdentifier(account)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{labelize(account.requestedRole)}</Badge>
                                        </TableCell>
                                        <TableCell>{formatDateTime(account.createdAt)}</TableCell>
                                        <TableCell>
                                            {account.lastSignInAt ? (
                                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" variant="outline">
                                                    Signed in
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Not signed in yet</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button onClick={() => setSelectedAccount(account)} size="sm" variant="outline">
                                                <Eye className="mr-2 h-4 w-4" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={Boolean(selectedAccount)} onOpenChange={(open) => !open && setSelectedAccount(null)}>
                {selectedAccount ? (
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{selectedAccount.fullName}</DialogTitle>
                            <DialogDescription>
                                Account created from the administrator Add Users workflow.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-md border p-4">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Login identifier</div>
                                <div className="mt-2 break-all font-medium">{getIdentifier(selectedAccount)}</div>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Requested role</div>
                                <div className="mt-2 font-medium">{labelize(selectedAccount.requestedRole)}</div>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                    <KeyRound className="h-4 w-4" /> Password source
                                </div>
                                <div className="mt-2 font-medium">{labelize(selectedAccount.passwordSource)}</div>
                                <p className="mt-1 text-xs text-muted-foreground">The actual password is not stored and cannot be viewed later.</p>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4" /> Registration
                                </div>
                                <div className="mt-2 font-medium">
                                    {selectedAccount.authUserExists && selectedAccount.profileExists && selectedAccount.accountConfirmed
                                        ? "Registered and confirmed"
                                        : "Needs administrator review"}
                                </div>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                    <CalendarClock className="h-4 w-4" /> Created
                                </div>
                                <div className="mt-2 font-medium">{formatDateTime(selectedAccount.createdAt)}</div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    By {selectedAccount.createdByName} ({labelize(selectedAccount.createdByRole)})
                                </p>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                    <Clock3 className="h-4 w-4" /> Last sign-in
                                </div>
                                <div className="mt-2 font-medium">
                                    {selectedAccount.lastSignInAt ? formatDateTime(selectedAccount.lastSignInAt) : "Not signed in yet"}
                                </div>
                            </div>
                            <div className="rounded-md border p-4 sm:col-span-2">
                                <div className="text-xs font-medium uppercase text-muted-foreground">User ID</div>
                                <div className="mt-2 break-all font-mono text-sm">{selectedAccount.userId}</div>
                            </div>
                        </div>

                        <DialogFooter>
                            {canViewFullProfiles ? (
                                <Button asChild>
                                    <Link href={`/dashboard/users/${selectedAccount.userId}`}>
                                        Open full profile
                                        <ExternalLink className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            ) : null}
                        </DialogFooter>
                    </DialogContent>
                ) : null}
            </Dialog>
        </div>
    )
}
