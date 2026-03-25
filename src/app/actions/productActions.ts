"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function approveProduct(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from("products").update({ status: 'approved' }).eq("id", id)

    if (error) throw error
    revalidatePath("/dashboard")
}

export async function rejectProduct(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from("products").update({ status: 'rejected' }).eq("id", id)

    if (error) throw error
    revalidatePath("/dashboard")
}

export async function adminLogin(formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        return { error: error.message }
    }

    redirect("/dashboard")
}

export async function adminLogout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/")
}
