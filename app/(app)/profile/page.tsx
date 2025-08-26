'use client';

import { Loading } from '@/common/components/Loading';
import { useAccountStore } from '@/stores/useAccountStore';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

const ProfileIndexPage: React.FC = () => {
  const router = useRouter();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  useEffect(() => {
    if (!selectedAccount) return;

    router.push(`/profile/${selectedAccount.user?.username}`);
  }, [selectedAccount]);

  return <Loading />;
};

export default ProfileIndexPage;
