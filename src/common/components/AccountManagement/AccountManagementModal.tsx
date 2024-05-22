import React from "react";
import Modal from "../Modal";
import { AccountObjectType } from "@/stores/useAccountStore";
import AccountManagement from "./AccountManagement";
import { AccountPlatformType } from "@/common/constants/accounts";
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";

type AccountManagementModalProps = {
  account: AccountObjectType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const AccountManagementModal = ({
  account,
  open,
  setOpen,
}: AccountManagementModalProps) => {
  const router = useRouter();
  if (!account) return;

  const renderReadOnlyAccountContent = () => (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-full">
        <ArrowDownTrayIcon className="w-8 h-8 text-white" />
      </div>
      <div className="mt-4 text-lg font-bold text-primary">
        Read-only account
      </div>
      <div className="text-sm text-center text-foreground/70">
        You can&apos;t manage this account yet
        <br />
        <Button
        className="mt-4"
          variant="outline"
          onClick={() => router.push("/login?signupOnly=true")}
        >
          Switch to a full account to manage this account ↗️
        </Button>
      </div>
    </div>
  );

  const renderEditableAccountContent = () => (
    <AccountManagement account={account} onSuccess={() => setOpen(false)}/>
  );

  return (
    <Modal
      title={`Manage account ${account.name}`}
      open={open}
      setOpen={setOpen}
    >
      <div className="my-4">
        {account.platform === AccountPlatformType.farcaster_local_readonly
          ? renderReadOnlyAccountContent()
          : renderEditableAccountContent()}
      </div>
    </Modal>
  );
};

export default AccountManagementModal;
