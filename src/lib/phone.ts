export function normalizePhoneNumber(value: string) {
    const compact = value.trim().replace(/[\s().-]/g, "")

    if (!compact) {
        return ""
    }

    if (compact.startsWith("+")) {
        return `+${compact.slice(1).replace(/\D/g, "")}`
    }

    const digits = compact.replace(/\D/g, "")

    if (digits.startsWith("234")) {
        return `+${digits}`
    }

    if (digits.startsWith("0")) {
        return `+234${digits.slice(1)}`
    }

    if (digits.length === 10) {
        return `+234${digits}`
    }

    return `+${digits}`
}

export function isValidE164PhoneNumber(value: string) {
    return /^\+[1-9]\d{7,14}$/.test(value)
}
