import { Flex, Dialog, IconButton, Box, Button, Callout, Link, Select, Text } from "@radix-ui/themes"
import { FileMessage, Message } from "../../../../../../../types/Messaging/Message"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ErrorText } from "@/components/common/Form"
import { Loader } from "@/components/common/Loader"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { ErrorBanner } from "@/components/layout/AlertBanner/ErrorBanner"
import LinkFormField from "@/components/common/LinkField/LinkFormField"
import { useEffect } from "react"
import { FileExtensionIcon } from "@/utils/layout/FileExtIcon"
import { getFileExtension, getFileName } from "@/utils/operations"
import { BiX } from "react-icons/bi"

interface SaveToDriveFolderModalProps {
    onClose: () => void,
    message: Message
}

interface SaveToDriveForm {
    sales_invoice: string,
    drive_target: string,
}

type DriveTarget = {
    value: string,
    label: string,
    drive_url?: string,
    folder_id?: string,
    available?: boolean,
}

const SaveToDriveFolderModal = ({ onClose, message }: SaveToDriveFolderModalProps) => {

    const methods = useForm<SaveToDriveForm>({
        defaultValues: {
            sales_invoice: "",
            drive_target: "",
        }
    })

    const { handleSubmit, reset, watch, setValue, register, formState: { errors } } = methods
    const sales_invoice = watch("sales_invoice")

    const { data: formData } = useFrappeGetCall(
        "raven_oah.api.drive_attach.get_save_to_drive_form",
        { message_id: message.name },
        undefined,
        { revalidateOnFocus: false }
    )

    const { data: targetData, isLoading: targetsLoading } = useFrappeGetCall(
        "raven_oah.api.drive_attach.get_drive_targets_for_invoice",
        sales_invoice ? { sales_invoice } : undefined,
        sales_invoice ? undefined : null,
        { revalidateOnFocus: false }
    )

    const { call, loading, error } = useFrappePostCall("raven_oah.api.drive_attach.save_to_drive_folder")

    useEffect(() => {
        if (formData?.message?.sales_invoice) {
            setValue("sales_invoice", formData.message.sales_invoice)
        }
    }, [formData, setValue])

    useEffect(() => {
        setValue("drive_target", "")
    }, [sales_invoice, setValue])

    const targets: DriveTarget[] = targetData?.message?.targets?.filter((t: DriveTarget) => t.available) || []

    useEffect(() => {
        if (targets.length === 1) {
            setValue("drive_target", targets[0].value)
        }
    }, [targets, setValue])

    register("drive_target", { required: "Select a Drive folder" })

    const onSubmit = (data: SaveToDriveForm) => {
        call({
            message_id: message.name,
            sales_invoice: data.sales_invoice,
            drive_target: data.drive_target,
        }).then((res) => {
            toast.success(res?.message?.message || "File saved to Drive.")
            handleClose()
        }).catch(() => {
            toast.error("Failed to save file to Drive.")
        })
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const fileMessage = message as FileMessage

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Flex justify={"between"}>
                    <Dialog.Title>Save to Drive Folder</Dialog.Title>
                    <Dialog.Description hidden>Save attachment to Sales Invoice drive folder</Dialog.Description>
                    <Dialog.Close onClick={handleClose}>
                        <IconButton size='1' variant="soft" color="gray">
                            <BiX size='18' />
                        </IconButton>
                    </Dialog.Close>
                </Flex>

                <Flex gap='2' direction='column' width='100%' mt='3'>
                    <ErrorBanner error={error} />
                    <Callout.Root>
                        <Callout.Icon>
                            <FileExtensionIcon ext={getFileExtension(fileMessage.file)} />
                        </Callout.Icon>
                        <Callout.Text>
                            <Link href={fileMessage.file}>
                                {getFileName(fileMessage.file)}
                            </Link>
                        </Callout.Text>
                    </Callout.Root>

                    <Box width='100%'>
                        <LinkFormField
                            name='sales_invoice'
                            label='Sales Invoice'
                            doctype="Sales Invoice"
                            autofocus
                            rules={{ required: "Sales Invoice is required" }}
                        />
                        <ErrorText>{errors.sales_invoice?.message}</ErrorText>
                    </Box>

                    {sales_invoice && (
                        <Box width='100%'>
                            <Text as="label" size="2" weight="medium">Drive Folder</Text>
                            {targetsLoading ? (
                                <Flex align="center" gap="2" mt="2">
                                    <Loader />
                                    <Text size="2" color="gray">Loading folders…</Text>
                                </Flex>
                            ) : targets.length === 0 ? (
                                <Callout.Root color="orange" mt="2">
                                    <Callout.Text>
                                        No Drive folder URLs on this Sales Invoice. Fill Drive Link or Shipping Address Drive Link on the invoice.
                                    </Callout.Text>
                                </Callout.Root>
                            ) : (
                                <>
                                    <Select.Root
                                        value={watch("drive_target")}
                                        onValueChange={(v) => setValue("drive_target", v, { shouldValidate: true })}
                                    >
                                        <Select.Trigger className="w-full mt-1" placeholder="Select folder" />
                                        <Select.Content>
                                            {targets.map((t) => (
                                                <Select.Item key={t.value} value={t.value}>
                                                    {t.label}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                    <ErrorText>{errors.drive_target?.message}</ErrorText>
                                </>
                            )}
                        </Box>
                    )}
                </Flex>

                <Flex gap="3" mt="6" justify="end" align='center'>
                    <Dialog.Close disabled={loading}>
                        <Button variant="soft" color="gray">Cancel</Button>
                    </Dialog.Close>
                    <Button type='submit' disabled={loading || !watch("drive_target")}>
                        {loading && <Loader className="text-white" />}
                        Save to Drive
                    </Button>
                </Flex>
            </form>
        </FormProvider>
    )
}

export default SaveToDriveFolderModal
