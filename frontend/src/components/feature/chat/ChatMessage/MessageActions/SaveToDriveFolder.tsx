import { Dialog } from '@radix-ui/themes'
import { useCallback, useState } from 'react'
import { Message } from '../../../../../../../types/Messaging/Message'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { Drawer, DrawerContent } from '@/components/layout/Drawer'
import SaveToDriveFolderModal from '../ActionModals/SaveToDriveFolderModal'

export const useSaveToDriveFolder = (onModalClose?: VoidFunction) => {
    const [message, setMessage] = useState<null | Message>(null)

    const onClose = useCallback(() => {
        setMessage(null)
        onModalClose?.()
    }, [onModalClose])

    return {
        message,
        setSaveToDrive: setMessage,
        isOpen: message !== null,
        onClose
    }
}

interface SaveToDriveFolderDialogProps {
    message: Message | null,
    isOpen: boolean,
    onClose: () => void
}

const SaveToDriveFolderDialog = ({ message, isOpen, onClose }: SaveToDriveFolderDialogProps) => {
    const isDesktop = useIsDesktop()

    if (isDesktop) {
        return <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Content className={'static'}>
                {message &&
                    <SaveToDriveFolderModal message={message} onClose={onClose} />
                }
            </Dialog.Content>
        </Dialog.Root>
    }

    return <Drawer open={isOpen} onClose={onClose}>
        <DrawerContent>
            <div className="pb-24">
                {message &&
                    <SaveToDriveFolderModal message={message} onClose={onClose} />
                }
            </div>
        </DrawerContent>
    </Drawer>
}

export default SaveToDriveFolderDialog
