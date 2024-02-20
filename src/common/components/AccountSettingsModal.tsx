import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { CastType } from '../constants/farcaster';
import { SelectableListWithHotkeys } from './SelectableListWithHotkeys';
import { openWindow } from '../helpers/navigation';
import { classNames } from '../helpers/css';
import { getUrlsInText } from '../helpers/text';
import uniqBy from 'lodash.uniqby';
import OpenGraphImage from './Embeds/OpenGraphImage';
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
