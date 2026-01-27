// @ts-nocheck
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            ledger_entries: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string
                    id: string
                    reference_id: string
                    wallet_id: string
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description: string
                    id?: string
                    reference_id: string
                    wallet_id: string
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string
                    id?: string
                    reference_id?: string
                    wallet_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "ledger_entries_wallet_id_fkey"
                        columns: ["wallet_id"]
                        isOneToOne: false
                        referencedRelation: "wallets"
                        referencedColumns: ["id"]
                    },
                ]
            }
            order_items: {
                Row: {
                    created_at: string | null
                    id: string
                    order_id: string
                    price_per_unit: number
                    product_id: string
                    quantity: number
                    total_price: number | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    order_id: string
                    price_per_unit: number
                    product_id: string
                    quantity: number
                    total_price?: number | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    order_id?: string
                    price_per_unit?: number
                    product_id?: string
                    quantity?: number
                    total_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "order_items_order_id_fkey"
                        columns: ["order_id"]
                        isOneToOne: false
                        referencedRelation: "orders"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "order_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            orders: {
                Row: {
                    created_at: string | null
                    customer_id: string
                    delivery_location: unknown | null
                    id: string
                    payment_ref: string | null
                    status: Database["public"]["Enums"]["order_status"] | null
                    total_amount: number
                }
                Insert: {
                    created_at?: string | null
                    customer_id: string
                    delivery_location?: unknown | null
                    id?: string
                    payment_ref?: string | null
                    status?: Database["public"]["Enums"]["order_status"] | null
                    total_amount: number
                }
                Update: {
                    created_at?: string | null
                    customer_id?: string
                    delivery_location?: unknown | null
                    id?: string
                    payment_ref?: string | null
                    status?: Database["public"]["Enums"]["order_status"] | null
                    total_amount?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "orders_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            products: {
                Row: {
                    category: Database["public"]["Enums"]["food_category"]
                    id: string
                    image_url: string | null
                    is_available: boolean | null
                    merchant_id: string
                    name: string
                    price: number
                    stock_level: number | null
                    sales_type: "retail" | "wholesale" | null
                }
                Insert: {
                    category: Database["public"]["Enums"]["food_category"]
                    id?: string
                    image_url?: string | null
                    is_available?: boolean | null
                    merchant_id: string
                    name: string
                    price: number
                    stock_level?: number | null
                    sales_type?: "retail" | "wholesale" | null
                }
                Update: {
                    category?: Database["public"]["Enums"]["food_category"]
                    id?: string
                    image_url?: string | null
                    is_available?: boolean | null
                    merchant_id?: string
                    name?: string
                    price?: number
                    stock_level?: number | null
                    sales_type?: "retail" | "wholesale" | null
                }
                Relationships: [
                    {
                        foreignKeyName: "products_merchant_id_fkey"
                        columns: ["merchant_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    full_name: string
                    id: string
                    phone: string | null
                    address: string | null
                    company_name: string | null
                    zip_code: string | null
                    state: string | null
                    street_address: string | null
                    house_number: string | null
                    location: unknown | null // geography(Point, 4326) comes back as string/object depending on driver, often ignored in types or set to unknown/string
                    updated_at: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    full_name: string
                    id: string
                    phone?: string | null
                    address?: string | null
                    company_name?: string | null
                    zip_code?: string | null
                    state?: string | null
                    street_address?: string | null
                    house_number?: string | null
                    location?: unknown | null
                    updated_at?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    full_name?: string
                    id?: string
                    phone?: string | null
                    address?: string | null
                    company_name?: string | null
                    zip_code?: string | null
                    state?: string | null
                    street_address?: string | null
                    house_number?: string | null
                    location?: unknown | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            rider_locations: {
                Row: {
                    current_location: unknown
                    rider_id: string
                    updated_at: string | null
                }
                Insert: {
                    current_location: unknown
                    rider_id: string
                    updated_at?: string | null
                }
                Update: {
                    current_location?: unknown
                    rider_id?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "rider_locations_rider_id_fkey"
                        columns: ["rider_id"]
                        isOneToOne: true
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_roles: {
                Row: {
                    created_at: string | null
                    id: string
                    role: Database["public"]["Enums"]["app_role"]
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    role: Database["public"]["Enums"]["app_role"]
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    role?: Database["public"]["Enums"]["app_role"]
                    user_id?: string
                }
                Relationships: []
            }
            wallets: {
                Row: {
                    balance: number
                    created_at: string | null
                    id: string
                    owner_id: string
                    type: Database["public"]["Enums"]["wallet_type"]
                }
                Insert: {
                    balance?: number
                    created_at?: string | null
                    id?: string
                    owner_id: string
                    type: Database["public"]["Enums"]["wallet_type"]
                }
                Update: {
                    balance?: number
                    created_at?: string | null
                    id?: string
                    owner_id?: string
                    type?: Database["public"]["Enums"]["wallet_type"]
                }
                Relationships: [
                    {
                        foreignKeyName: "wallets_owner_id_fkey"
                        columns: ["owner_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            wallet_transactions: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string | null
                    id: string
                    reference: string
                    status: string
                    type: string
                    wallet_id: string
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    reference: string
                    status: string
                    type: string
                    wallet_id: string
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    reference?: string
                    status?: string
                    type?: string
                    wallet_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "wallet_transactions_wallet_id_fkey"
                        columns: ["wallet_id"]
                        isOneToOne: false
                        referencedRelation: "wallets"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            calculate_delivery_fee: {
                Args: {
                    distance_meters: number
                }
                Returns: number
            }
            decrement_stock: {
                Args: {
                    p_product_id: string
                    p_quantity: number
                }
                Returns: undefined
            }
            find_nearby_riders: {
                Args: {
                    p_lat: number
                    p_long: number
                    radius_meters?: number
                }
                Returns: {
                    rider_id: string
                    distance_meters: number
                    lat: number
                    long: number
                }[]
            }
            handle_new_user: {
                Args: Record<PropertyKey, never>
                Returns: unknown
            }
            sync_user_roles: {
                Args: Record<PropertyKey, never>
                Returns: unknown
            }
        }
        Enums: {
            app_role: "customer" | "merchant" | "rider" | "admin" | "agent"
            food_category:
            | "fresh_produce"
            | "tubers"
            | "grains"
            | "oils"
            | "spices"
            | "proteins"
            | "packaged"
            | "specialty"
            order_status:
            | "pending"
            | "processing"
            | "out_for_delivery"
            | "delivered"
            | "completed"
            wallet_type: "merchant" | "rider" | "commission"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof Database["public"]["CompositeTypes"]
    ? Database["public"]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
