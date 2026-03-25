"use client"

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from "@tanstack/react-table"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {

    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    ChevronDown,
    MoreHorizontal,
    ShieldAlert,
    ShieldCheck,
    User,
    ArrowUpDown,
    Search,
    Filter,
    Download,
    Copy,
    ExternalLink
} from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

// --- Column Definitions ---
export const columns: ColumnDef<any>[] = [
    {
        accessorKey: "full_name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const user = row.original
            const initials = user.full_name
                ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
                : 'U'
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium">{user.full_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{user.company_name}</span>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => <div className="text-sm">{row.getValue("phone") || "N/A"}</div>
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string | null
            if (!status) return <span className="text-muted-foreground text-xs">-</span>

            return (
                <Badge variant={status === "approved" ? "default" : status === "pending" ? "secondary" : "destructive"} className="capitalize">
                    {status}
                </Badge>
            )
        }
    },
    {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
            const role = row.getValue("role") as string
            return <RoleBadge role={role} />
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "points_balance",
        header: ({ column }) => (
            <div className="text-right">Points</div>
        ),
        cell: ({ row }) => {
            const points = row.getValue("points_balance") as number || 0
            return <div className="text-right font-medium">{points.toLocaleString()}</div>
        }
    },
    {
        accessorKey: "updated_at",
        header: "Last Active",
        cell: ({ row }) => {
            const date = row.getValue("updated_at") as string
            return <div className="text-sm text-muted-foreground">{date ? new Date(date).toLocaleDateString() : "N/A"}</div>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const user = row.original
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const router = useRouter()
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { toast } = useToast()

            const copyToClipboard = (text: string, description: string) => {
                navigator.clipboard.writeText(text)
                toast({
                    title: "Copied",
                    description: `${description} copied to clipboard.`
                })
            }

            return (
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                className="cursor-pointer gap-2"
                                onSelect={() => copyToClipboard(user.id, "Account ID")}
                            >
                                <Copy className="h-4 w-4 text-muted-foreground" /> Copy ID
                            </DropdownMenuCheckboxItem>
                            {user.phone && (
                                <DropdownMenuCheckboxItem
                                    className="cursor-pointer gap-2"
                                    onSelect={() => copyToClipboard(user.phone, "Phone Number")}
                                >
                                    <Copy className="h-4 w-4 text-muted-foreground" /> Copy Phone
                                </DropdownMenuCheckboxItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                className="cursor-pointer gap-2"
                                onSelect={() => router.push(`/dashboard/users/${user.id}`)}
                            >
                                <ExternalLink className="h-4 w-4 text-muted-foreground" /> View Profile
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        }
    }
]

function RoleBadge({ role }: { role: string }) {
    switch (role) {
        case "supa_admin":
            return <Badge variant="destructive" className="gap-1 py-0.5 text-xs"><ShieldAlert className="h-3 w-3" /> Super Admin</Badge>
        case "sub_admin":
        case "admin":
            return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500 py-0.5 text-xs"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
        case "merchant":
            return <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 py-0.5 text-xs">Merchant</Badge>
        case "agent":
            return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 py-0.5 text-xs">Agent</Badge>
        case "rider":
            return <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 py-0.5 text-xs">Rider</Badge>
        default:
            return <Badge variant="outline" className="gap-1 py-0.5 text-xs"><User className="h-3 w-3" /> Customer</Badge>
    }
}

// --- Main Data Table Component ---
export function AccountsDataTable({ data }: { data: any[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})
    const [globalFilter, setGlobalFilter] = useState("")
    const router = useRouter()
    const { toast } = useToast()

    const exportToCSV = () => {
        try {
            const rows = table.getFilteredRowModel().rows.map(r => r.original)
            if (rows.length === 0) {
                toast({ title: "Export Failed", description: "No data to export.", variant: "destructive" })
                return
            }

            const headers = ["ID", "Full Name", "Company", "Phone", "Status", "Role", "Points Balance", "Location Locked", "Created/Updated"]
            const csvContent = [
                headers.join(","),
                ...rows.map(r => [
                    r.id,
                    `"${r.full_name || ""}"`,
                    `"${r.company_name || ""}"`,
                    r.phone || "",
                    r.status || "Unknown",
                    r.role || "Customer",
                    r.points_balance || 0,
                    r.location_locked ? "Yes" : "No",
                    r.updated_at || ""
                ].join(","))
            ].join("\n")

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.setAttribute("href", url)
            link.setAttribute("download", `rssa_accounts_export_${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            toast({ title: "Export Started", description: `Exporting ${rows.length} accounts to CSV.` })
        } catch (error) {
            console.error("CSV Export failed", error)
            toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" })
        }
    }

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, columnId, filterValue) => {
            // Custom simplified global filter for name and phone
            const safeValue = (() => {
                const val = row.getValue("full_name")
                return typeof val === 'string' ? val.toLowerCase() : ''
            })()
            const phone = (() => {
                const val = row.getValue("phone")
                return typeof val === 'string' ? val.toLowerCase() : ''
            })()
            const filter = String(filterValue).toLowerCase()
            return safeValue.includes(filter) || phone.includes(filter)
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
        },
    })

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or phone..."
                        value={globalFilter ?? ""}
                        onChange={(event) =>
                            setGlobalFilter(event.target.value)
                        }
                        className="pl-8"
                    />
                </div>

                <div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <Button variant="outline" onClick={exportToCSV} className="whitespace-nowrap shadow-sm ml-auto sm:ml-0">
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shadow-sm">
                                <Filter className="mr-2 h-4 w-4" /> Role
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={!(table.getColumn("role")?.getFilterValue() as string[])}
                                onCheckedChange={() => table.getColumn("role")?.setFilterValue(undefined)}
                            >
                                All Roles
                            </DropdownMenuCheckboxItem>
                            {["supa_admin", "admin", "merchant", "agent", "rider", "customer"].map((role) => (
                                <DropdownMenuCheckboxItem
                                    key={role}
                                    checked={(table.getColumn("role")?.getFilterValue() as string[])?.includes(role)}
                                    onCheckedChange={(checked) => {
                                        const current = (table.getColumn("role")?.getFilterValue() as string[]) || []
                                        const next = checked
                                            ? [...current, role]
                                            : current.filter((value) => value !== role)
                                        table.getColumn("role")?.setFilterValue(next.length ? next : undefined)
                                    }}
                                >
                                    <span className="capitalize">{role.replace('_', ' ')}</span>
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shadow-sm">
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id.replace("_", " ")}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/20">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={() => router.push(`/dashboard/users/${row.original.id}`)}
                                    className="cursor-pointer group hover:bg-muted/30 transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} row(s) total.
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
