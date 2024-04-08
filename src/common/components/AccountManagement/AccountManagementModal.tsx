import React, { useEffect, useState } from "react";
import Modal from "../Modal";
import { AccountObjectType } from "@/stores/useAccountStore";
import AccountManagement from "./AccountManagement";

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
  if (!account) return;

  return (
    <Modal
      title={`Manage account ${account.name}`}
      open={open}
      setOpen={setOpen}
    >
      <div className="my-4">
        <AccountManagement account={account} />
      </div>
    </Modal>
  );
};

export default AccountManagementModal;
