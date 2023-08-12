import { AccountPlatformType, AccountStatusType } from "@/common/constants/accounts";
import { CommandType } from "@/common/constants/commands";
import { supabaseClient } from "@/common/helpers/supabase";
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { createJSONStorage, devtools } from "zustand/middleware";

export type AccountObjectType = {
  id: number | null;
  userId?: string;
  name: string;
  status: AccountStatusType;
  publicKey: string;
  privateKey: string;
  platform: AccountPlatformType;
  platformAccountId: string;
  createdAt?: string;
  data?: { deepLinkUrl: string, signerToken: string };
}

interface AccountStoreProps {
  selectedAccountIdx: number;
  accounts: AccountObjectType[];
  _hydrated: boolean;
}

interface AccountStoreActions {
  addAccount: (account: AccountObjectType & { privateKey: string, data: object }) => void;
  setAccountActive: (accountId: number, data: any) => void;
  removeAccount: (idx: number) => void;
  setCurrentAccount: (idx: number) => void;
}

export interface AccountStore extends AccountStoreProps, AccountStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get,
    {
      'name': 'accounts',
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
      // storage: createJSONStorage(() => getStateStorageForStore(tauriStore)),
    }
  );

type StoreSet = (fn: (draft: Draft<AccountStore>) => void) => void;

const store = (set: StoreSet) => ({
  accounts: [],
  selectedAccountIdx: 0,
  _hydrated: false,
  addAccount: (account: AccountObjectType) => {
    supabaseClient
      .from('accounts')
      .insert({
        name: account.name,
        status: account.status,
        public_key: account.publicKey,
        account_platform: account.platform,
        data: account.data,
        private_key: account.privateKey,
      })
      .select()
      .then(({ error, data }) => {
        console.log('response - data', data, 'error', error);

        if (!data || error) return;
        set((state) => {
          state.accounts.push({ ...account, ...{ id: data[0].id } });
        });
      })
  },
  setAccountActive: (accountId: number, data: any) => {
    set((state) => {
      supabaseClient
        .from('accounts')
        .update({ status: AccountStatusType.active, ...data })
        .eq('id', accountId)
        .then(({ error, data }) => {
          console.log('response setAccountActive - data', data, 'error', error);
          if (!error) {
            state.accounts.forEach((account) => {
              if (account.id === accountId) {
                account.status = AccountStatusType.active;
              }
            });
          }
        });
    });
  },
  removeAccount: (idx: number) => {
    set((state) => {
      state.accounts.splice(idx, 1);
    });
  },
  setCurrentAccount: (idx: number) => {
    set((state) => {
      state.selectedAccountIdx = idx;
    });
  },
});
export const useAccountStore = create<AccountStore>()(devtools(mutative(store)));

const hydrate = async () => {
  const { data: { user } } = await supabaseClient.auth.getUser()
  const { data: accountData, error: accountError } = await supabaseClient
    .from('decrypted_accounts')
    .select('*')
    .eq('user_id', user?.id)

  if (accountError) {
    console.error('error hydrating account store', accountError);
    return;
  }

  if (accountData.length === 0) {
    console.log('no accounts found');
  } else {
    const accountsForState: AccountObjectType[] = accountData.map((account) => ({
      id: account.id,
      name: account.name,
      status: account.status,
      publicKey: account.public_key,
      platform: account.platform,
      platformAccountId: account.platform_account_id,
      createdAt: account.created_at,
      privateKey: '',
      data: account.data,
    }))
    useAccountStore.setState({
      accounts: accountsForState,
      selectedAccountIdx: 0,
      _hydrated: true
    });
  }

  console.log('done hydrating account store')
}

hydrate();

const switchAccountTo = (idx: number) => {
  if (idx < 0) return;

  const store = useAccountStore.getState();
  if (idx > store.accounts.length) return;
  store.setCurrentAccount(idx);
};

const getAccountCommands = () => {
  let accountCommands: CommandType[] = [];

  for (let i = 0; i < 9; i++) {
    accountCommands.push({
      name: `Switch to account ${i + 1}`,
      aliases: [`account ${i + 1}`],
      shortcut: `ctrl+${i + 1}`,
      enableOnFormTags: true,
      action: () => {
        switchAccountTo(i);
      },
      enabled: () => useAccountStore.getState().accounts.length > i,
    });
  }

  return accountCommands;
};

export const accountCommands = getAccountCommands();
