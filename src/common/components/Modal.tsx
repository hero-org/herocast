import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';

type ModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title?: string | React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  focusMode?: boolean;
}

const Modal = ({ open, setOpen, title, description, children, focusMode }: ModalProps) => (
  <Dialog.Root open={open} onOpenChange={setOpen} modal={focusMode || true}>
    <Dialog.Portal>
      <Dialog.Overlay className="z-20 bg-muted/95 data-[state=open]:animate-overlayShow fixed inset-0" />
      <Dialog.Content className="z-30 data-[state=open]:animate-contentShow fixed bg-background top-[45%] left-[50%] w-[100vw] max-w-[600px] translate-x-[-50%] translate-y-[-40%] rounded-[6px] p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
        {title && (
          <Dialog.Title className="text-card-foreground m-0 text-[17px] font-medium">
            {title}
          </Dialog.Title>
        )}
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
            <Cross2Icon />
          </button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Modal;
