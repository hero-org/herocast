import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type React from 'react';

type ModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title?: string | React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  focusMode?: boolean;
};

const Modal: React.FC<ModalProps> = ({ open, setOpen, title, description, children, focusMode }) => {
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-50 bg-muted/95 data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content
          className="z-50 data-[state=open]:animate-contentShow fixed top-[45%] left-[50%] w-[100vw] max-w-[600px] translate-x-[-50%] translate-y-[-40%] rounded-2xl border border-border bg-popover text-popover-foreground p-[25px] shadow-lg focus:outline-none"
          onOpenAutoFocus={focusMode ? undefined : (e) => e.preventDefault()}
          onCloseAutoFocus={focusMode ? undefined : (e) => e.preventDefault()}
        >
          {title && <Dialog.Title className="text-card-foreground m-0 text-[17px] font-medium">{title}</Dialog.Title>}
          {description && (
            <Dialog.Description className="text-card-foreground/80 mt-[10px] mb-5 text-[15px] leading-normal">
              {description}
            </Dialog.Description>
          )}
          {children}
          <Dialog.Close asChild>
            <button
              className="text-card-foreground/80 bg-background/90 focus:shadow-background/90 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
              aria-label="Close"
            >
              <X />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
