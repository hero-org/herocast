import { AccountPlatformType, AccountStatusType } from "@/common/constants/accounts";
import { ChannelType, channels } from "@/common/constants/channels";
import { CommandType } from "@/common/constants/commands";
import { supabaseClient } from "@/common/helpers/supabase";
import isEmpty from "lodash.isempty";
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { createJSONStorage, devtools } from "zustand/middleware";

export type AccountObjectType = {
  id: number | null;
  userId?: string;
  name: string;
  status: AccountStatusType;
  publicKey: string;
  platform: AccountPlatformType;
  platformAccountId: string;
  privateKey?: string;
  createdAt?: string;
  data?: { deepLinkUrl: string, signerToken: string };
}

interface AccountStoreProps {
  selectedAccountIdx: number;
  selectedChannelIdx: number | null;
  accounts: AccountObjectType[];
  channels: ChannelType[];
  _hydrated: boolean;
}

interface AccountStoreActions {
  addAccount: (account: AccountObjectType & { privateKey: string, data: object }) => void;
  setAccountActive: (accountId: number, data: any) => void;
  removeAccount: (idx: number) => void;
  setCurrentAccountIdx: (idx: number) => void;
  setCurrentChannelIdx: (idx: number | null) => void;
  resetCurrentChannel: () => void;
  resetStore: () => void;
}


export interface AccountStore extends AccountStoreProps, AccountStoreActions { }

const initialState: AccountStoreProps = {
  accounts: [],
  channels: [],
  selectedAccountIdx: 0,
  selectedChannelIdx: null,
  _hydrated: false,
};

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
  ...initialState,
  addAccount: (account: AccountObjectType & { privateKey: string, data: object }) => {
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
  setCurrentAccountIdx: (idx: number) => {
    set((state) => {
      state.selectedAccountIdx = idx;
    });
  },
  setCurrentChannelIdx: (idx: number) => {
    set((state) => {
      state.selectedChannelIdx = idx;
    });
  },
  resetCurrentChannel: () => {
    set((state) => {
      state.selectedChannelIdx = null;
    })
  },
  resetStore: () => {
    set((state) => {
      Object.entries(initialState).forEach(([key, value]) => {
        state[key] = value;
      });
    })
  }
});
export const useAccountStore = create<AccountStore>()(devtools(mutative(store)));

export const hydrate = async () => {
  console.log('hydrating 💦');
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no account to hydrate');
    return;
  }

  const { data: accountData, error: accountError } = await supabaseClient
    .from('accounts')
    // .from('accounts')
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
      data: account.data,
      privateKey: '', // account.decrypted_private_key,
    }))

    useAccountStore.setState({
      accounts: accountsForState,
      channels: channels,
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
  store.setCurrentAccountIdx(idx);
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

const getChannelCommands = () => {
  let channelCommands: CommandType[] = [];

  channelCommands.push({
    name: `Switch to follow feed`,
    aliases: ['follow feed', 'following', 'feed', 'home'],
    shortcut: 'shift+0',
    enableOnFormTags: true,
    action: () => {
      useAccountStore.getState().resetCurrentChannel();
    },
  });

  // channelCommands.push({
  //   name: `Switch to next channel`,
  //   aliases: ['channel down'],
  //   shortcut: 'shift+j',
  //   enableOnFormTags: true,
  //   action: () => {
  //     const state = useAccountStore.getState();
  //     const newIdx = state.currentChannelIdx || -1 + 1;
  //     if (newIdx < state.channels.length) {
  //       state.setCurrentChannelIdx(newIdx);
  //     }
  //   },
  // });
  // channelCommands.push({
  //   name: `Switch to previous channel`,
  //   aliases: ['channel up'],
  //   shortcut: 'shift+k',
  //   enableOnFormTags: true,
  //   action: () => {
  //     const state = useAccountStore.getState();
  //     const newIdx = state.currentChannelIdx - 1;
  //     if (newIdx < 0) {
  //       state.resetCurrentChannel();
  //     } else if (newIdx < state.channels.length) {
  //       state.setCurrentChannelIdx(newIdx);
  //     }
  //   },
  // });

  // const channels = useAccountStore.getState().channels;
  for (let i = 0; i < 9; i++) {
    // const channelName = useAccountStore.getState().channels[i].name;
    channelCommands.push({
      name: `Switch to channel ${i + 1}`,
      aliases: [], //[`channel ${channelName}`],
      shortcut: `shift+${i + 1}`,
      enableOnFormTags: true,
      action: () => {
        const state = useAccountStore.getState();
        if (isEmpty(state.channels)) return;

        state.setCurrentChannelIdx(i);
      },
    });
  }

  return channelCommands;
}

export const accountCommands = getAccountCommands();
export const channelCommands = getChannelCommands();
