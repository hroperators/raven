import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes"
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { getErrorMessage } from "@/components/layout/AlertBanner/ErrorBanner"

type ManualSyncForm = {
    contact: {
        name: string
        first_name?: string
        last_name?: string
        mobile_no?: string
        phone?: string
        email_id?: string
        oah_external_contact_id?: string
    }
    customer?: {
        name: string
        customer_name?: string
        customer_custom_drive?: string
    } | null
    address?: {
        name: string
        address_line1?: string
        address_line2?: string
        city?: string
        state?: string
        pincode?: string
    } | null
    oah_linked?: boolean
}

type ManualSyncDialogProps = {
    doctype: string
    docname: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSynced?: () => void
}

export const ManualSyncDialog = ({ doctype, docname, open, onOpenChange, onSynced }: ManualSyncDialogProps) => {
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: ManualSyncForm }>(
        "hr_telephony.manual_sync.get_manual_sync_form",
        { doctype, docname },
        open ? `manual-sync-form-${doctype}-${docname}` : null,
        { revalidateOnFocus: false, shouldRetryOnError: false }
    )

    const { call } = useContext(FrappeContext) as FrappeConfig
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!open) return
        const payload = data?.message
        if (!payload?.contact) return

        setForm({
            first_name: payload.contact.first_name || "",
            last_name: payload.contact.last_name || "",
            mobile_no: payload.contact.mobile_no || "",
            phone: payload.contact.phone || "",
            email_id: payload.contact.email_id || "",
            customer_custom_drive: payload.customer?.customer_custom_drive || "",
            address_line1: payload.address?.address_line1 || "",
            address_line2: payload.address?.address_line2 || "",
            city: payload.address?.city || "",
            state: payload.address?.state || "",
            pincode: payload.address?.pincode || "",
        })
    }, [open, data])

    const payload = data?.message

    const updateField = (field: string, value: string) => {
        setForm((current) => ({ ...current, [field]: value }))
    }

    const onSave = () => {
        if (!payload?.contact?.name) return

        const syncPayload = {
            contact: {
                name: payload.contact.name,
                first_name: form.first_name,
                last_name: form.last_name,
                mobile_no: form.mobile_no,
                phone: form.phone,
                email_id: form.email_id,
            },
            customer: payload.customer?.name
                ? {
                      name: payload.customer.name,
                      customer_custom_drive: form.customer_custom_drive,
                  }
                : null,
            address: payload.address?.name
                ? {
                      name: payload.address.name,
                      address_line1: form.address_line1,
                      address_line2: form.address_line2,
                      city: form.city,
                      state: form.state,
                      pincode: form.pincode,
                  }
                : null,
        }

        setSaving(true)
        call
            .post("hr_telephony.manual_sync.run_manual_sync", { payload: JSON.stringify(syncPayload) })
            .then((res) => {
                const message = res?.message?.message || "Saved and synced to Office@Hand."
                toast.success(message)
                onOpenChange(false)
                mutate()
                onSynced?.()
            })
            .catch((err) => {
                toast.error("Manual sync failed", { description: getErrorMessage(err) })
            })
            .finally(() => setSaving(false))
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Content maxWidth="520px">
                <Dialog.Title>Manual Sync to Office@Hand</Dialog.Title>
                <Dialog.Description size="2" mb="3">
                    {payload?.oah_linked
                        ? "This contact is linked to Office@Hand. Edit fields below, then save and sync."
                        : "This contact is not linked yet. Edit fields below, then save and sync."}
                </Dialog.Description>

                {isLoading && <Text size="2">Loading...</Text>}
                {error && <Text size="2" color="red">Could not load sync form.</Text>}

                {payload?.contact && !isLoading && (
                    <Flex direction="column" gap="3">
                        <Text size="2" weight="medium">Contact</Text>
                        <TextField.Root placeholder="First Name" value={form.first_name || ""} onChange={(e) => updateField("first_name", e.target.value)} />
                        <TextField.Root placeholder="Last Name" value={form.last_name || ""} onChange={(e) => updateField("last_name", e.target.value)} />
                        <TextField.Root placeholder="Mobile No" value={form.mobile_no || ""} onChange={(e) => updateField("mobile_no", e.target.value)} />
                        <TextField.Root placeholder="Phone" value={form.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                        <TextField.Root placeholder="Email" value={form.email_id || ""} onChange={(e) => updateField("email_id", e.target.value)} />

                        {payload.customer?.name && (
                            <>
                                <Text size="2" weight="medium">Customer: {payload.customer.customer_name || payload.customer.name}</Text>
                                <TextField.Root
                                    placeholder="Customer Drive Link"
                                    value={form.customer_custom_drive || ""}
                                    onChange={(e) => updateField("customer_custom_drive", e.target.value)}
                                />
                            </>
                        )}

                        {payload.address?.name && (
                            <>
                                <Text size="2" weight="medium">Primary Address</Text>
                                <TextField.Root placeholder="Address Line 1" value={form.address_line1 || ""} onChange={(e) => updateField("address_line1", e.target.value)} />
                                <TextField.Root placeholder="Address Line 2" value={form.address_line2 || ""} onChange={(e) => updateField("address_line2", e.target.value)} />
                                <TextField.Root placeholder="City" value={form.city || ""} onChange={(e) => updateField("city", e.target.value)} />
                                <TextField.Root placeholder="State" value={form.state || ""} onChange={(e) => updateField("state", e.target.value)} />
                                <TextField.Root placeholder="Pincode" value={form.pincode || ""} onChange={(e) => updateField("pincode", e.target.value)} />
                            </>
                        )}
                    </Flex>
                )}

                <Flex gap="3" mt="4" justify="end">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">Cancel</Button>
                    </Dialog.Close>
                    <Button onClick={onSave} disabled={isLoading || saving || !payload?.contact}>
                        {saving ? "Syncing..." : "Save & Sync"}
                    </Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    )
}
