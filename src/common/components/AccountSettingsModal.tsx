import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { AccountObjectType } from '@/stores/useAccountStore';
import RenameAccountForm from './RenameAccountForm';

type AccountSettingsModalProps = {
  account: AccountObjectType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const AccountSettingsModal = ({ account, open, setOpen }: AccountSettingsModalProps) => {
  if (!account) return;

  return (
    <Modal
      title={`Manage account ${account.name}`}
      open={open}
      setOpen={setOpen}
    >
      <div className="my-4">
        <RenameAccountForm account={account} />
      </div>
    </Modal>
  )
};

export default AccountSettingsModal;
