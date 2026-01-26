'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect } from 'react';
import { Loading } from '@/common/components/Loading';
import { useAccountStore } from '@/stores/useAccountStore';

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
