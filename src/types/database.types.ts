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
            ads: {
                Row: {
                    created_at: string | null
                    id: string
                    is_active: boolean | null
                    media_type: string | null
                    media_url: string
                    public_id: string | null
                    title: string
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    is_active?: boolean | null
                    media_type?: string | null
                    media_url: string
                    public_id?: string | null
                    title: string
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    is_active?: boolean | null
                    media_type?: string | null
                    media_url?: string
                    public_id?: string | null
                    title?: string
                    updated_at?: string | null
                }
                Relationships: []
            }
            app_settings: {
                Row: {
                    description: string | null
                    key: string
                    value: Json
                }
                Insert: {
                    description?: string | null
                    key: string
                    value: Json
                }
                Update: {
                    description?: string | null
                    key?: string
                    value?: Json
                }
                Relationships: []
            }
            cook_off_entries: {
                Row: {
                    admin_creativity_score: number | null
                    admin_feedback: string | null
                    admin_presentation_score: number | null
                    cooking_process_video_public_id: string
                    cooking_process_video_url: string
                    created_at: string
                    entry_code: string
                    id: string
                    ingredients: string
                    is_featured: boolean
                    presentation_video_public_id: string
                    presentation_video_url: string
                    recipe_name: string
                    reviewed_at: string | null
                    reviewed_by: string | null
                    session_id: string
                    status: string
                    submitter_email: string
                    submitter_name: string
                    submitter_phone: string | null
                    updated_at: string
                    user_id: string
                    winner_position: number | null
                }
                Insert: {
                    admin_creativity_score?: number | null
                    admin_feedback?: string | null
                    admin_presentation_score?: number | null
                    cooking_process_video_public_id: string
                    cooking_process_video_url: string
                    created_at?: string
                    entry_code?: string
                    id?: string
                    ingredients: string
                    is_featured?: boolean
                    presentation_video_public_id: string
                    presentation_video_url: string
                    recipe_name: string
                    reviewed_at?: string | null
                    reviewed_by?: string | null
                    session_id: string
                    status?: string
                    submitter_email: string
                    submitter_name: string
                    submitter_phone?: string | null
                    updated_at?: string
                    user_id: string
                    winner_position?: number | null
                }
                Update: {
                    admin_creativity_score?: number | null
                    admin_feedback?: string | null
                    admin_presentation_score?: number | null
                    cooking_process_video_public_id?: string
                    cooking_process_video_url?: string
                    created_at?: string
                    entry_code?: string
                    id?: string
                    ingredients?: string
                    is_featured?: boolean
                    presentation_video_public_id?: string
                    presentation_video_url?: string
                    recipe_name?: string
                    reviewed_at?: string | null
                    reviewed_by?: string | null
                    session_id?: string
                    status?: string
                    submitter_email?: string
                    submitter_name?: string
                    submitter_phone?: string | null
                    updated_at?: string
                    user_id?: string
                    winner_position?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cook_off_entries_reviewed_by_fkey"
                        columns: ["reviewed_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cook_off_entries_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "cook_off_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cook_off_entries_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cook_off_sessions: {
                Row: {
                    created_at: string
                    created_by: string | null
                    cta_text: string
                    description: string | null
                    hero_media_public_id: string | null
                    hero_media_thumbnail_public_id: string | null
                    hero_media_thumbnail_url: string | null
                    hero_media_type: string | null
                    hero_media_url: string | null
                    id: string
                    month_label: string
                    prizes: string | null
                    rules: string | null
                    slug: string
                    status: string
                    summary: string | null
                    theme: string
                    title: string
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    created_at?: string
                    created_by?: string | null
                    cta_text?: string
                    description?: string | null
                    hero_media_public_id?: string | null
                    hero_media_thumbnail_public_id?: string | null
                    hero_media_thumbnail_url?: string | null
                    hero_media_type?: string | null
                    hero_media_url?: string | null
                    id?: string
                    month_label: string
                    prizes?: string | null
                    rules?: string | null
                    slug: string
                    status?: string
                    summary?: string | null
                    theme: string
                    title: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    created_at?: string
                    created_by?: string | null
                    cta_text?: string
                    description?: string | null
                    hero_media_public_id?: string | null
                    hero_media_thumbnail_public_id?: string | null
                    hero_media_thumbnail_url?: string | null
                    hero_media_type?: string | null
                    hero_media_url?: string | null
                    id?: string
                    month_label?: string
                    prizes?: string | null
                    rules?: string | null
                    slug?: string
                    status?: string
                    summary?: string | null
                    theme?: string
                    title?: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cook_off_sessions_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cook_off_sessions_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cook_off_votes: {
                Row: {
                    created_at: string
                    entry_id: string
                    id: string
                    session_id: string
                    voter_id: string
                }
                Insert: {
                    created_at?: string
                    entry_id: string
                    id?: string
                    session_id: string
                    voter_id: string
                }
                Update: {
                    created_at?: string
                    entry_id?: string
                    id?: string
                    session_id?: string
                    voter_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "cook_off_votes_entry_id_fkey"
                        columns: ["entry_id"]
                        isOneToOne: false
                        referencedRelation: "cook_off_entries"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cook_off_votes_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "cook_off_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cook_off_votes_voter_id_fkey"
                        columns: ["voter_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            gift_card_transactions: {
                Row: {
                    actor_id: string | null
                    amount_kobo: number
                    created_at: string
                    description: string
                    gift_card_id: string
                    id: string
                    metadata: Json
                    reference: string | null
                    transaction_type: string
                }
                Insert: {
                    actor_id?: string | null
                    amount_kobo: number
                    created_at?: string
                    description: string
                    gift_card_id: string
                    id?: string
                    metadata?: Json
                    reference?: string | null
                    transaction_type: string
                }
                Update: {
                    actor_id?: string | null
                    amount_kobo?: number
                    created_at?: string
                    description?: string
                    gift_card_id?: string
                    id?: string
                    metadata?: Json
                    reference?: string | null
                    transaction_type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "gift_card_transactions_actor_id_fkey"
                        columns: ["actor_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
                        columns: ["gift_card_id"]
                        isOneToOne: false
                        referencedRelation: "gift_cards"
                        referencedColumns: ["id"]
                    },
                ]
            }
            gift_cards: {
                Row: {
                    amount_kobo: number
                    code: string
                    created_at: string
                    delivered_at: string | null
                    expires_at: string | null
                    id: string
                    last_used_at: string | null
                    message: string | null
                    payment_method: string
                    payment_reference: string
                    purchaser_id: string
                    recipient_email: string
                    recipient_id: string
                    remaining_amount_kobo: number
                    status: string
                    updated_at: string
                }
                Insert: {
                    amount_kobo: number
                    code: string
                    created_at?: string
                    delivered_at?: string | null
                    expires_at?: string | null
                    id?: string
                    last_used_at?: string | null
                    message?: string | null
                    payment_method: string
                    payment_reference: string
                    purchaser_id: string
                    recipient_email: string
                    recipient_id: string
                    remaining_amount_kobo: number
                    status?: string
                    updated_at?: string
                }
                Update: {
                    amount_kobo?: number
                    code?: string
                    created_at?: string
                    delivered_at?: string | null
                    expires_at?: string | null
                    id?: string
                    last_used_at?: string | null
                    message?: string | null
                    payment_method?: string
                    payment_reference?: string
                    purchaser_id?: string
                    recipient_email?: string
                    recipient_id?: string
                    remaining_amount_kobo?: number
                    status?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "gift_cards_purchaser_id_fkey"
                        columns: ["purchaser_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "gift_cards_recipient_id_fkey"
                        columns: ["recipient_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            discount_bundle_items: {
                Row: {
                    bundle_id: string
                    created_at: string
                    id: string
                    product_id: string
                    quantity: number
                    sort_order: number
                }
                Insert: {
                    bundle_id: string
                    created_at?: string
                    id?: string
                    product_id: string
                    quantity: number
                    sort_order?: number
                }
                Update: {
                    bundle_id?: string
                    created_at?: string
                    id?: string
                    product_id?: string
                    quantity?: number
                    sort_order?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "discount_bundle_items_bundle_id_fkey"
                        columns: ["bundle_id"]
                        isOneToOne: false
                        referencedRelation: "discount_bundles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "discount_bundle_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            discount_bundle_page_content: {
                Row: {
                    closing_body: string | null
                    closing_cta_text: string
                    closing_cta_url: string
                    closing_title: string
                    created_at: string
                    description: string | null
                    eyebrow_text: string
                    feature_points: Json
                    hero_media_public_id: string | null
                    hero_media_type: string
                    hero_media_url: string | null
                    highlight_text: string | null
                    primary_cta_text: string
                    primary_cta_url: string
                    secondary_description: string | null
                    secondary_heading: string
                    slug: string
                    title: string
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    closing_body?: string | null
                    closing_cta_text?: string
                    closing_cta_url?: string
                    closing_title?: string
                    created_at?: string
                    description?: string | null
                    eyebrow_text?: string
                    feature_points?: Json
                    hero_media_public_id?: string | null
                    hero_media_type?: string
                    hero_media_url?: string | null
                    highlight_text?: string | null
                    primary_cta_text?: string
                    primary_cta_url?: string
                    secondary_description?: string | null
                    secondary_heading?: string
                    slug?: string
                    title?: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    closing_body?: string | null
                    closing_cta_text?: string
                    closing_cta_url?: string
                    closing_title?: string
                    created_at?: string
                    description?: string | null
                    eyebrow_text?: string
                    feature_points?: Json
                    hero_media_public_id?: string | null
                    hero_media_type?: string
                    hero_media_url?: string | null
                    highlight_text?: string | null
                    primary_cta_text?: string
                    primary_cta_url?: string
                    secondary_description?: string | null
                    secondary_heading?: string
                    slug?: string
                    title?: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "discount_bundle_page_content_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            discount_bundles: {
                Row: {
                    badge_text: string | null
                    bundle_price_kobo: number
                    button_text: string
                    campaign_ends_at: string | null
                    campaign_starts_at: string | null
                    card_media_public_id: string
                    card_media_type: string
                    card_media_url: string
                    compare_at_price_kobo: number
                    created_at: string
                    created_by: string | null
                    description: string | null
                    discount_mode: string
                    discount_percent: number | null
                    fixed_price_kobo: number | null
                    id: string
                    is_featured: boolean
                    product_id: string
                    slug: string
                    sort_order: number
                    status: string
                    summary: string | null
                    title: string
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    badge_text?: string | null
                    bundle_price_kobo?: number
                    button_text?: string
                    campaign_ends_at?: string | null
                    campaign_starts_at?: string | null
                    card_media_public_id: string
                    card_media_type?: string
                    card_media_url: string
                    compare_at_price_kobo?: number
                    created_at?: string
                    created_by?: string | null
                    description?: string | null
                    discount_mode?: string
                    discount_percent?: number | null
                    fixed_price_kobo?: number | null
                    id?: string
                    is_featured?: boolean
                    product_id: string
                    slug: string
                    sort_order?: number
                    status?: string
                    summary?: string | null
                    title: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    badge_text?: string | null
                    bundle_price_kobo?: number
                    button_text?: string
                    campaign_ends_at?: string | null
                    campaign_starts_at?: string | null
                    card_media_public_id?: string
                    card_media_type?: string
                    card_media_url?: string
                    compare_at_price_kobo?: number
                    created_at?: string
                    created_by?: string | null
                    description?: string | null
                    discount_mode?: string
                    discount_percent?: number | null
                    fixed_price_kobo?: number | null
                    id?: string
                    is_featured?: boolean
                    product_id?: string
                    slug?: string
                    sort_order?: number
                    status?: string
                    summary?: string | null
                    title?: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "discount_bundles_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "discount_bundles_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: true
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "discount_bundles_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            hero_carousel_slides: {
                Row: {
                    body_text: string | null
                    button_text: string | null
                    button_url: string | null
                    created_at: string
                    created_by: string | null
                    eyebrow_text: string | null
                    highlight_text: string | null
                    id: string
                    is_active: boolean
                    marketing_mode: string
                    media_public_id: string
                    media_type: string
                    media_url: string
                    placement: string
                    sort_order: number
                    thumbnail_public_id: string | null
                    thumbnail_url: string | null
                    title: string
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    body_text?: string | null
                    button_text?: string | null
                    button_url?: string | null
                    created_at?: string
                    created_by?: string | null
                    eyebrow_text?: string | null
                    highlight_text?: string | null
                    id?: string
                    is_active?: boolean
                    marketing_mode?: string
                    media_public_id: string
                    media_type: string
                    media_url: string
                    placement?: string
                    sort_order?: number
                    thumbnail_public_id?: string | null
                    thumbnail_url?: string | null
                    title: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    body_text?: string | null
                    button_text?: string | null
                    button_url?: string | null
                    created_at?: string
                    created_by?: string | null
                    eyebrow_text?: string | null
                    highlight_text?: string | null
                    id?: string
                    is_active?: boolean
                    marketing_mode?: string
                    media_public_id?: string
                    media_type?: string
                    media_url?: string
                    placement?: string
                    sort_order?: number
                    thumbnail_public_id?: string | null
                    thumbnail_url?: string | null
                    title?: string
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "hero_carousel_slides_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "hero_carousel_slides_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            notifications: {
                Row: {
                    action_url: string | null
                    id: string
                    user_id: string
                    metadata: Json
                    title: string
                    message: string
                    type: string | null
                    read: boolean | null
                    created_at: string
                }
                Insert: {
                    action_url?: string | null
                    id?: string
                    user_id: string
                    metadata?: Json
                    title: string
                    message: string
                    type?: string | null
                    read?: boolean | null
                    created_at?: string
                }
                Update: {
                    action_url?: string | null
                    id?: string
                    user_id?: string
                    metadata?: Json
                    title?: string
                    message?: string
                    type?: string | null
                    read?: boolean | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "notifications_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
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
                    agent_accepted_at: string | null
                    agent_assigned_at: string | null
                    assigned_agent_id: string | null
                    assignment_method: Database["public"]["Enums"]["assignment_method"] | null
                    contact_numbers: Json | null
                    created_at: string | null
                    customer_id: string
                    delivery_code: string | null
                    delivery_fee: number | null
                    delivery_fee_kobo: number
                    delivery_location: Json | null
                    delivery_verified_at: string | null
                    id: string
                    merchant_confirmed_at: string | null
                    merchant_id: string | null
                    payment_status: Database["public"]["Enums"]["payment_status"]
                    payment_ref: string | null
                    points_discount_kobo: number
                    points_redeemed: number
                    pickup_code: string | null
                    pickup_verified_at: string | null
                    rider_assigned_at: string | null
                    rider_id: string | null
                    rider_requested_at: string | null
                    status: Database["public"]["Enums"]["order_status"] | null
                    subtotal_amount_kobo: number
                    total_amount: number
                }
                Insert: {
                    agent_accepted_at?: string | null
                    agent_assigned_at?: string | null
                    assigned_agent_id?: string | null
                    assignment_method?: Database["public"]["Enums"]["assignment_method"] | null
                    contact_numbers?: Json | null
                    created_at?: string | null
                    customer_id: string
                    delivery_code?: string | null
                    delivery_fee?: number | null
                    delivery_fee_kobo?: number
                    delivery_location?: Json | null
                    delivery_verified_at?: string | null
                    id?: string
                    merchant_confirmed_at?: string | null
                    merchant_id?: string | null
                    payment_status?: Database["public"]["Enums"]["payment_status"]
                    payment_ref?: string | null
                    points_discount_kobo?: number
                    points_redeemed?: number
                    pickup_code?: string | null
                    pickup_verified_at?: string | null
                    rider_assigned_at?: string | null
                    rider_id?: string | null
                    rider_requested_at?: string | null
                    status?: Database["public"]["Enums"]["order_status"] | null
                    subtotal_amount_kobo?: number
                    total_amount: number
                }
                Update: {
                    agent_accepted_at?: string | null
                    agent_assigned_at?: string | null
                    assigned_agent_id?: string | null
                    assignment_method?: Database["public"]["Enums"]["assignment_method"] | null
                    contact_numbers?: Json | null
                    created_at?: string | null
                    customer_id?: string
                    delivery_code?: string | null
                    delivery_fee?: number | null
                    delivery_fee_kobo?: number
                    delivery_location?: Json | null
                    delivery_verified_at?: string | null
                    id?: string
                    merchant_confirmed_at?: string | null
                    merchant_id?: string | null
                    payment_status?: Database["public"]["Enums"]["payment_status"]
                    payment_ref?: string | null
                    points_discount_kobo?: number
                    points_redeemed?: number
                    pickup_code?: string | null
                    pickup_verified_at?: string | null
                    rider_assigned_at?: string | null
                    rider_id?: string | null
                    rider_requested_at?: string | null
                    status?: Database["public"]["Enums"]["order_status"] | null
                    subtotal_amount_kobo?: number
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
                    {
                        foreignKeyName: "orders_assigned_agent_id_fkey"
                        columns: ["assigned_agent_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "orders_merchant_id_fkey"
                        columns: ["merchant_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "orders_rider_id_fkey"
                        columns: ["rider_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            point_transactions: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string | null
                    expires_at: string | null
                    id: string
                    is_expired: boolean | null
                    type: Database["public"]["Enums"]["point_transaction_type"]
                    user_id: string
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description?: string | null
                    expires_at?: string | null
                    id?: string
                    is_expired?: boolean | null
                    type: Database["public"]["Enums"]["point_transaction_type"]
                    user_id: string
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string | null
                    expires_at?: string | null
                    id?: string
                    is_expired?: boolean | null
                    type?: Database["public"]["Enums"]["point_transaction_type"]
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "point_transactions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            reward_point_balances: {
                Row: {
                    available_points: number
                    created_at: string
                    debt_points: number
                    pending_points: number
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    available_points?: number
                    created_at?: string
                    debt_points?: number
                    pending_points?: number
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    available_points?: number
                    created_at?: string
                    debt_points?: number
                    pending_points?: number
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reward_point_balances_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            reward_point_events: {
                Row: {
                    available_balance_after: number
                    created_at: string
                    debt_balance_after: number
                    description: string
                    event_type: string
                    id: string
                    lot_id: string | null
                    metadata: Json
                    pending_balance_after: number
                    points_delta: number
                    redemption_id: string | null
                    source_id: string | null
                    source_kind: string | null
                    user_id: string
                }
                Insert: {
                    available_balance_after?: number
                    created_at?: string
                    debt_balance_after?: number
                    description: string
                    event_type: string
                    id?: string
                    lot_id?: string | null
                    metadata?: Json
                    pending_balance_after?: number
                    points_delta: number
                    redemption_id?: string | null
                    source_id?: string | null
                    source_kind?: string | null
                    user_id: string
                }
                Update: {
                    available_balance_after?: number
                    created_at?: string
                    debt_balance_after?: number
                    description?: string
                    event_type?: string
                    id?: string
                    lot_id?: string | null
                    metadata?: Json
                    pending_balance_after?: number
                    points_delta?: number
                    redemption_id?: string | null
                    source_id?: string | null
                    source_kind?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reward_point_events_lot_id_fkey"
                        columns: ["lot_id"]
                        isOneToOne: false
                        referencedRelation: "reward_point_lots"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reward_point_events_redemption_id_fkey"
                        columns: ["redemption_id"]
                        isOneToOne: false
                        referencedRelation: "reward_point_redemptions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reward_point_events_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            reward_point_lots: {
                Row: {
                    available_at: string | null
                    created_at: string
                    description: string | null
                    expires_at: string | null
                    id: string
                    is_pending: boolean
                    metadata: Json
                    offset_points: number
                    original_points: number
                    remaining_points: number
                    source_id: string | null
                    source_key: string
                    source_kind: string
                    status: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    available_at?: string | null
                    created_at?: string
                    description?: string | null
                    expires_at?: string | null
                    id?: string
                    is_pending?: boolean
                    metadata?: Json
                    offset_points?: number
                    original_points: number
                    remaining_points: number
                    source_id?: string | null
                    source_key: string
                    source_kind: string
                    status?: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    available_at?: string | null
                    created_at?: string
                    description?: string | null
                    expires_at?: string | null
                    id?: string
                    is_pending?: boolean
                    metadata?: Json
                    offset_points?: number
                    original_points?: number
                    remaining_points?: number
                    source_id?: string | null
                    source_key?: string
                    source_kind?: string
                    status?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reward_point_lots_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            reward_point_redemptions: {
                Row: {
                    created_at: string
                    description: string | null
                    discount_kobo: number
                    id: string
                    metadata: Json
                    order_id: string
                    points_used: number
                    restored_at: string | null
                    status: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    description?: string | null
                    discount_kobo: number
                    id?: string
                    metadata?: Json
                    order_id: string
                    points_used: number
                    restored_at?: string | null
                    status?: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    description?: string | null
                    discount_kobo?: number
                    id?: string
                    metadata?: Json
                    order_id?: string
                    points_used?: number
                    restored_at?: string | null
                    status?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reward_point_redemptions_order_id_fkey"
                        columns: ["order_id"]
                        isOneToOne: true
                        referencedRelation: "orders"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reward_point_redemptions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            products: {
                Row: {
                    active_pricing_id: string | null
                    add_tax: boolean | null
                    category: Database["public"]["Enums"]["food_category"]
                    created_at: string | null
                    description: string | null
                    discount_price: number | null
                    has_options: boolean | null
                    id: string
                    image_url: string | null
                    images: string[] | null
                    is_available: boolean | null
                    is_perishable: boolean | null
                    merchant_id: string
                    name: string
                    options: Json | null
                    price: number
                    sales_type: string | null
                    seo_description: string | null
                    seo_title: string | null
                    state: string | null
                    stock_level: number | null
                    status: string | null
                    submitted_for_review_at: string | null
                    tags: string[] | null
                    weight: string | null
                }
                Insert: {
                    active_pricing_id?: string | null
                    add_tax?: boolean | null
                    category: Database["public"]["Enums"]["food_category"]
                    created_at?: string | null
                    description?: string | null
                    discount_price?: number | null
                    has_options?: boolean | null
                    id?: string
                    image_url?: string | null
                    images?: string[] | null
                    is_available?: boolean | null
                    is_perishable?: boolean | null
                    merchant_id: string
                    name: string
                    options?: Json | null
                    price: number
                    sales_type?: string | null
                    seo_description?: string | null
                    seo_title?: string | null
                    state?: string | null
                    stock_level?: number | null
                    status?: string | null
                    submitted_for_review_at?: string | null
                    tags?: string[] | null
                    weight?: string | null
                }
                Update: {
                    active_pricing_id?: string | null
                    add_tax?: boolean | null
                    category?: Database["public"]["Enums"]["food_category"]
                    created_at?: string | null
                    description?: string | null
                    discount_price?: number | null
                    has_options?: boolean | null
                    id?: string
                    image_url?: string | null
                    images?: string[] | null
                    is_available?: boolean | null
                    is_perishable?: boolean | null
                    merchant_id?: string
                    name?: string
                    options?: Json | null
                    price?: number
                    sales_type?: string | null
                    seo_description?: string | null
                    seo_title?: string | null
                    state?: string | null
                    stock_level?: number | null
                    status?: string | null
                    submitted_for_review_at?: string | null
                    tags?: string[] | null
                    weight?: string | null
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
            referral_commissions: {
                Row: {
                    commission_amount_kobo: number
                    commission_bps: number
                    created_at: string
                    id: string
                    metadata: Json
                    referred_user_id: string
                    referrer_id: string
                    source_amount_kobo: number
                    source_kind: string
                    source_ledger_entry_id: string
                    source_reference_id: string | null
                }
                Insert: {
                    commission_amount_kobo: number
                    commission_bps: number
                    created_at?: string
                    id?: string
                    metadata?: Json
                    referred_user_id: string
                    referrer_id: string
                    source_amount_kobo: number
                    source_kind: string
                    source_ledger_entry_id: string
                    source_reference_id?: string | null
                }
                Update: {
                    commission_amount_kobo?: number
                    commission_bps?: number
                    created_at?: string
                    id?: string
                    metadata?: Json
                    referred_user_id?: string
                    referrer_id?: string
                    source_amount_kobo?: number
                    source_kind?: string
                    source_ledger_entry_id?: string
                    source_reference_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "referral_commissions_referred_user_id_fkey"
                        columns: ["referred_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "referral_commissions_referrer_id_fkey"
                        columns: ["referrer_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "referral_commissions_source_ledger_entry_id_fkey"
                        columns: ["source_ledger_entry_id"]
                        isOneToOne: false
                        referencedRelation: "ledger_entries"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    address: string | null
                    avatar_url: string | null
                    company_name: string | null
                    full_name: string
                    house_number: string | null
                    id: string
                    location: unknown | null
                    location_last_verified_at: string | null
                    location_locked: boolean | null
                    location_update_requested_at: string | null
                    phone: string | null
                    points_balance: number | null
                    referral_code: string | null
                    referred_by: string | null
                    state: string | null
                    street_address: string | null
                    update_requested: boolean | null
                    updated_at: string | null
                    zip_code: string | null
                }
                Insert: {
                    address?: string | null
                    avatar_url?: string | null
                    company_name?: string | null
                    full_name: string
                    house_number?: string | null
                    id: string
                    location?: unknown | null
                    location_last_verified_at?: string | null
                    location_locked?: boolean | null
                    location_update_requested_at?: string | null
                    phone?: string | null
                    points_balance?: number | null
                    referral_code?: string | null
                    referred_by?: string | null
                    state?: string | null
                    street_address?: string | null
                    update_requested?: boolean | null
                    updated_at?: string | null
                    zip_code?: string | null
                }
                Update: {
                    address?: string | null
                    avatar_url?: string | null
                    company_name?: string | null
                    full_name?: string
                    house_number?: string | null
                    id?: string
                    location?: unknown | null
                    location_last_verified_at?: string | null
                    location_locked?: boolean | null
                    location_update_requested_at?: string | null
                    phone?: string | null
                    points_balance?: number | null
                    referral_code?: string | null
                    referred_by?: string | null
                    state?: string | null
                    street_address?: string | null
                    update_requested?: boolean | null
                    updated_at?: string | null
                    zip_code?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_referred_by_fkey"
                        columns: ["referred_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
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
            support_conversations: {
                Row: {
                    access_token_hash: string
                    ai_enabled_snapshot: boolean
                    channel: string
                    created_at: string
                    escalated_to_human: boolean
                    id: string
                    last_ai_message_at: string | null
                    last_customer_message_at: string | null
                    last_message_at: string
                    last_message_preview: string | null
                    resolved_by_ai: boolean
                    status: string
                    subject: string | null
                    updated_at: string
                    user_id: string | null
                    visitor_email: string
                    visitor_name: string
                    visitor_phone: string | null
                }
                Insert: {
                    access_token_hash: string
                    ai_enabled_snapshot?: boolean
                    channel?: string
                    created_at?: string
                    escalated_to_human?: boolean
                    id?: string
                    last_ai_message_at?: string | null
                    last_customer_message_at?: string | null
                    last_message_at?: string
                    last_message_preview?: string | null
                    resolved_by_ai?: boolean
                    status?: string
                    subject?: string | null
                    updated_at?: string
                    user_id?: string | null
                    visitor_email: string
                    visitor_name: string
                    visitor_phone?: string | null
                }
                Update: {
                    access_token_hash?: string
                    ai_enabled_snapshot?: boolean
                    channel?: string
                    created_at?: string
                    escalated_to_human?: boolean
                    id?: string
                    last_ai_message_at?: string | null
                    last_customer_message_at?: string | null
                    last_message_at?: string
                    last_message_preview?: string | null
                    resolved_by_ai?: boolean
                    status?: string
                    subject?: string | null
                    updated_at?: string
                    user_id?: string | null
                    visitor_email?: string
                    visitor_name?: string
                    visitor_phone?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "support_conversations_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            support_messages: {
                Row: {
                    ai_generated: boolean
                    body: string
                    conversation_id: string
                    created_at: string
                    escalation_marker: boolean
                    id: string
                    metadata: Json
                    response_time_ms: number | null
                    sender_id: string | null
                    sender_role: string
                }
                Insert: {
                    ai_generated?: boolean
                    body: string
                    conversation_id: string
                    created_at?: string
                    escalation_marker?: boolean
                    id?: string
                    metadata?: Json
                    response_time_ms?: number | null
                    sender_id?: string | null
                    sender_role: string
                }
                Update: {
                    ai_generated?: boolean
                    body?: string
                    conversation_id?: string
                    created_at?: string
                    escalation_marker?: boolean
                    id?: string
                    metadata?: Json
                    response_time_ms?: number | null
                    sender_id?: string | null
                    sender_role?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "support_messages_conversation_id_fkey"
                        columns: ["conversation_id"]
                        isOneToOne: false
                        referencedRelation: "support_conversations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "support_messages_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
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
            wallet_transactions: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string | null
                    id: string
                    reference: string | null
                    status: string | null
                    type: string | null
                    wallet_id: string | null
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    reference?: string | null
                    status?: string | null
                    type?: string | null
                    wallet_id?: string | null
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    reference?: string | null
                    status?: string | null
                    type?: string | null
                    wallet_id?: string | null
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
            wallets: {
                Row: {
                    balance: number
                    created_at: string | null
                    id: string
                    owner_id: string
                    type: Database["public"]["Enums"]["wallet_type"]
                    virtual_account: Json | null
                }
                Insert: {
                    balance?: number
                    created_at?: string | null
                    id?: string
                    owner_id: string
                    type?: Database["public"]["Enums"]["wallet_type"]
                    virtual_account?: Json | null
                }
                Update: {
                    balance?: number
                    created_at?: string | null
                    id?: string
                    owner_id?: string
                    type?: Database["public"]["Enums"]["wallet_type"]
                    virtual_account?: Json | null
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
        }
        Views: {
            cook_off_entry_scoreboard: {
                Row: {
                    admin_creativity_score: number | null
                    admin_feedback: string | null
                    admin_presentation_score: number | null
                    admin_score: number | null
                    cooking_process_video_public_id: string | null
                    cooking_process_video_url: string | null
                    created_at: string | null
                    entry_code: string | null
                    entry_id: string | null
                    is_featured: boolean | null
                    presentation_video_public_id: string | null
                    presentation_video_url: string | null
                    recipe_name: string | null
                    session_id: string | null
                    submitter_email: string | null
                    submitter_name: string | null
                    submitter_phone: string | null
                    user_id: string | null
                    vote_count: number | null
                    winner_position: number | null
                }
                Relationships: []
            }
            cook_off_vote_totals: {
                Row: {
                    entry_id: string | null
                    session_id: string | null
                    vote_count: number | null
                }
                Relationships: []
            }
        }
        Functions: {
            cast_cook_off_vote: {
                Args: {
                    p_entry_id: string
                }
                Returns: Json
            }
            create_paid_order: {
                Args: {
                    p_user_id: string
                    p_items: Json
                    p_delivery_location: Json
                    p_delivery_fee_kobo?: number
                    p_contact_numbers?: Json
                    p_payment_reference?: string | null
                    p_points_to_redeem?: number
                }
                Returns: Json
            }
            create_paid_order_with_gift_card: {
                Args: {
                    p_user_id: string
                    p_items: Json
                    p_delivery_location: Json
                    p_delivery_fee_kobo?: number
                    p_contact_numbers?: Json
                    p_payment_reference?: string | null
                    p_points_to_redeem?: number
                }
                Returns: Json
            }
            create_pending_gift_card_purchase: {
                Args: {
                    p_recipient_email: string
                    p_amount_kobo: number
                    p_message?: string | null
                }
                Returns: Json
            }
            create_pending_order: {
                Args: {
                    p_user_id: string
                    p_items: Json
                    p_delivery_location: Json
                    p_delivery_fee_kobo?: number
                    p_contact_numbers?: Json
                    p_payment_reference?: string | null
                    p_points_to_redeem?: number
                }
                Returns: Json
            }
            cancel_unpaid_order: {
                Args: {
                    p_order_id: string
                }
                Returns: Json
            }
            generate_referral_code: {
                Args: {
                    p_seed?: string | null
                }
                Returns: string
            }
            get_reward_checkout_summary: {
                Args: {
                    p_subtotal_kobo: number
                }
                Returns: Json
            }
            get_my_referral_overview: {
                Args: Record<PropertyKey, never>
                Returns: Json
            }
            get_referral_admin_dashboard: {
                Args: {
                    p_limit?: number
                }
                Returns: Json
            }
            get_referral_commission_bps: {
                Args: Record<PropertyKey, never>
                Returns: number
            }
            get_support_ai_settings: {
                Args: Record<PropertyKey, never>
                Returns: Json
            }
            get_support_conversation_snapshot: {
                Args: {
                    p_access_token?: string
                    p_conversation_id: string
                }
                Returns: Json
            }
            handle_wallet_credit: {
                Args: {
                    p_user_id: string
                    p_amount: number
                    p_reference: string
                    p_description: string
                }
                Returns: Json
            }
            initiate_withdrawal: {
                Args: {
                    amount_kobo: number
                    bank_code: string
                    account_number: string
                    bank_name: string
                    reference: string
                    description: string
                }
                Returns: Json
            }
            lookup_gift_card_recipient: {
                Args: {
                    p_email: string
                }
                Returns: Json
            }
            mark_pending_order_paid: {
                Args: {
                    p_order_id: string
                    p_payment_reference?: string | null
                }
                Returns: Json
            }
            mark_gift_card_purchase_paid: {
                Args: {
                    p_gift_card_id: string
                    p_payment_reference: string
                    p_amount_kobo: number
                }
                Returns: Json
            }
            purchase_gift_card_with_wallet: {
                Args: {
                    p_recipient_email: string
                    p_amount_kobo: number
                    p_message?: string | null
                }
                Returns: Json
            }
            start_support_conversation: {
                Args: {
                    p_channel?: string
                    p_email: string
                    p_initial_message: string
                    p_name: string
                    p_phone?: string
                    p_subject?: string
                }
                Returns: Json
            }
            append_support_customer_message: {
                Args: {
                    p_access_token: string
                    p_conversation_id: string
                    p_message: string
                }
                Returns: Json
            }
            append_support_assistant_message: {
                Args: {
                    p_access_token: string
                    p_ai_generated?: boolean
                    p_body: string
                    p_conversation_id: string
                    p_metadata?: Json
                    p_resolved_by_ai?: boolean
                    p_response_time_ms?: number
                    p_sender_role?: string
                    p_should_escalate?: boolean
                }
                Returns: Json
            }
            support_hash_token: {
                Args: {
                    p_token: string
                }
                Returns: string
            }
            support_user_can_access_conversation: {
                Args: {
                    p_access_token?: string
                    p_conversation_id: string
                }
                Returns: boolean
            }
            sync_user_roles: {
                Args: Record<PropertyKey, never>
                Returns: unknown
            }
        }
        Enums: {
            app_role: [
                "customer",
                "merchant",
                "rider",
                "admin",
                "agent",
                "supa_admin",
                "sub_admin"
            ]
            assignment_method: ["auto", "manual", "override", "claim"]
            dispute_status: ["open", "investigating", "resolved", "rejected", "refunded"]
            food_category: [
                "fresh_produce",
                "tubers",
                "grains",
                "oils",
                "spices",
                "proteins",
                "packaged",
                "specialty"
            ]
            order_status: [
                "pending",
                "processing",
                "ready_for_pickup",
                "out_for_delivery",
                "delivered",
                "completed",
                "awaiting_agent_acceptance",
                "awaiting_merchant_confirmation",
                "cancelled",
                "disputed",
                "refunded"
            ]
            payment_status: ["pending", "paid", "failed", "refunded"]
            point_transaction_type: [
                "referral_bonus",
                "purchase_redemption",
                "expired",
                "admin_adjustment"
            ]
            product_status: ["pending", "approved", "rejected"]
            refund_status: ["pending", "approved", "processed", "rejected"]
            settlement_status: ["pending", "completed", "failed", "refunded", "disputed"]
            wallet_type: ["merchant", "rider", "commission", "customer", "agent"]
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: "public" },
    TableName extends PublicTableNameOrOptions extends { schema: "public" }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: "public" }
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
    | { schema: "public" },
    TableName extends PublicTableNameOrOptions extends { schema: "public" }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: "public" }
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
    | { schema: "public" },
    TableName extends PublicTableNameOrOptions extends { schema: "public" }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: "public" }
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
    | { schema: "public" },
    EnumName extends PublicEnumNameOrOptions extends { schema: "public" }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: "public" }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: "public" },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: "public"
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: "public" }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof Database["public"]["CompositeTypes"]
    ? Database["public"]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
