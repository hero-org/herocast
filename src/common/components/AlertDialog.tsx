import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';

type AlertDialogProps = {
  buttonText: string;
  onClick: () => void;
};

const AlertDialogDemo = ({ buttonText, onClick }: AlertDialogProps) => (
  <AlertDialog.Root>
    <AlertDialog.Trigger asChild>
      <Button variant="outline">
        {buttonText}
      </Button>        
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="bg-[#FFFFFFAF] data-[state=open]:animate-overlayShow fixed inset-0" />
      <AlertDialog.Content className="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-radix-slate10 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
        <AlertDialog.Title className="text-radix-mauve1 m-0 text-[20px] font-medium">
          Are you absolutely sure?
        </AlertDialog.Title>
        <AlertDialog.Description className="text-radix-mauve1 mt-4 mb-5 text-[15px] leading-normal">
          This action cannot be undone. <br />This will disconnect your account from herocast.
        </AlertDialog.Description>
        <div className="flex justify-end gap-[25px]">
          <AlertDialog.Cancel asChild>
            <Button variant="outline">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild onClick={() => onClick()}>
            <Button variant="destructive">
              Yes, disconnect account
            </Button>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
);

export default AlertDialogDemo;
