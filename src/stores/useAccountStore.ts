import { AccountPlatformType, AccountStatusType } from "../../src/common/constants/accounts";
import { ChannelType } from "../../src/common/constants/channels";
import { CommandType } from "../../src/common/constants/commands";
import { randomNumberBetween } from "../../src/common/helpers/math";
import { supabaseClient } from "../../src/common/helpers/supabase";
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { createJSONStorage, devtools } from "zustand/middleware";
import isEmpty from "lodash.isempty";
import findIndex from 'lodash.findindex';
import sortBy from "lodash.sortby";
import cloneDeep from "lodash.clonedeep";
import { UUID } from "crypto";

export const PENDING_ACCOUNT_NAME_PLACEHOLDER = "New Account";
export enum CUSTOM_CHANNELS {
  FOLLOWING = 'following',
  TRENDING = 'trending',
}

const CUSTOM_CHANNEL_TO_IDX = {
  [CUSTOM_CHANNELS.FOLLOWING]: 0,
  [CUSTOM_CHANNELS.TRENDING]: 1,
};

const CUSTOM_CHANNEL_COUNT = 2;

export const DEFAULT_CHANNEL_URL = CUSTOM_CHANNELS.FOLLOWING;

type AccountChannelType = ChannelType & {
  idx: number;
  lastRead?: string; // can be a timestamp
}

type AddChannelProps = {
  name: string;
  url: string;
  iconUrl?: string;
  account: string;
}

type UpdatedPinnedChannelIndicesProps = {
  oldIndex: number;
  newIndex: number;
}

export type AccountObjectType = {
  id: UUID;
  userId?: string;
  name?: string;
  status: AccountStatusType;
  publicKey: `0x${string}`;
  platform: AccountPlatformType;
  platformAccountId?: string;
  privateKey?: `0x${string}`;
  createdAt?: string;
  data?: { deeplinkUrl?: string, signerToken?: string };
  channels: AccountChannelType[];
}

interface AccountStoreProps {
  selectedAccountIdx: number;
  selectedChannelUrl: string;
  accounts: AccountObjectType[];
  allChannels: ChannelType[];
  hydrated: boolean;
}

interface AccountStoreActions {
  addAccount: (account: Omit<AccountObjectType, 'channels'> & { privateKey?: string }) => void;
  addChannel: (props: AddChannelProps) => void;
  updatedPinnedChannelIndices: ({ oldIndex, newIndex }: UpdatedPinnedChannelIndicesProps) => void;
  setAccountActive: (accountId: UUID, name: string, data: { platform_account_id: string, data?: object }) => void;
  updateAccountUsername: (accountId: UUID, username: string) => void;
  removeAccount: (idx: number) => void;
  setCurrentAccountIdx: (idx: number) => void;
  setSelectedChannelUrl: (url: string | null) => void;
  setSelectedChannelByName: (name: string) => void;
  resetSelectedChannel: () => void;
  resetStore: () => void;
  addPinnedChannel: (channel: ChannelType) => void;
  removePinnedChannel: (channel: ChannelType) => void;
}


export interface AccountStore extends AccountStoreProps, AccountStoreActions { }

const initialState: AccountStoreProps = {
  accounts: [],
  allChannels: [],
  selectedAccountIdx: 0,
  selectedChannelUrl: DEFAULT_CHANNEL_URL,
  hydrated: false,
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
  addAccount: async (account: AccountObjectType & { privateKey: string }) => {
    await supabaseClient
      .from('accounts')
      .insert({
        name: account.name,
        status: account.status,
        public_key: account.publicKey,
        platform: account.platform,
        data: account.data || {},
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
    console.log('----> addAccount done')
  },
  setAccountActive: async (accountId: UUID, name: string, data: { platform_account_id: string, data?: object }) => {
    set(async (state) => {
      const { error } = await supabaseClient
        .from('accounts')
        .update({ name, status: AccountStatusType.active, ...data })
        .eq('id', accountId)
        .select()

      console.log('response setAccountActive - data', data, 'error', error);
      if (!error) {
        const accountIndex = state.accounts.findIndex((account) => account.id === accountId);
        const account = state.accounts[accountIndex];
        account.status = AccountStatusType.active;
        state.accounts[accountIndex] = account;
      }
      console.log('-----> setAcountActive done')
    });
  },
  updateAccountUsername: async (accountId: UUID, username: string) => {
    set(async (state) => {
      const { data, error } = await supabaseClient
        .from('accounts')
        .update({ name: username })
        .eq('id', accountId)
        .select();

      console.log('response updateAccountUsername - data', data, 'error', error);
      if (!error) {
        const accountIndex = state.accounts.findIndex((account) => account.id === accountId);
        const account = state.accounts[accountIndex];
        account.name = username;
        state.accounts[accountIndex] = account;
      }
    });
  },
  removeAccount: (idx: number) => {
    set(async (state) => {
      await supabaseClient
        .from('accounts')
        .update({ status: AccountStatusType.removed })
        .eq('id', state.accounts[idx].id)
        .select()
        .then(({ error, data }) => {
          console.log('response removeAccount - data', data, 'error', error);
        });

      const copy = [...state.accounts];
      copy.splice(idx, 1);
      state.accounts = copy;
    });
  },
  setCurrentAccountIdx: (idx: number) => {
    set((state) => {
      state.selectedAccountIdx = idx;
    });
  },
  setSelectedChannelUrl: (url: string) => {
    set((state) => {
      state.selectedChannelUrl = url;
    });
  },
  setSelectedChannelByName: (name: string) => {
    set((state) => {
      name = (name.startsWith('/') ? name.slice(1) : name).toLowerCase();
      const channel = state.allChannels.find((channel) => channel.name === name);
      if (channel) {
        state.selectedChannelUrl = channel.url;
      }
    });
  },
  resetSelectedChannel: () => {
    set((state) => {
      state.selectedChannelUrl = DEFAULT_CHANNEL_URL;
    })
  },
  resetStore: () => {
    set((state) => {
      Object.entries(initialState).forEach(([key, value]) => {
        state[key] = value;
      });
    })
  },
  addPinnedChannel: (channel: ChannelType) => {
    set((state) => {
      const account = state.accounts[state.selectedAccountIdx];
      const idx = account.channels.length
      const newChannel = { ...channel, idx };
      account.channels = [...account.channels, newChannel]
      state.accounts[state.selectedAccountIdx] = account;

      supabaseClient
        .from('accounts_to_channel')
        .insert({
          account_id: account.id,
          channel_id: channel.id,
          index: idx,
        })
        .select('*')
        .then(({ error, data }) => {
          // console.log('response - data', data, 'error', error);
        });
    })
  },
  removePinnedChannel: (channel: ChannelType) => {
    set((state) => {
      const account = state.accounts[state.selectedAccountIdx];

      if (!channel.id || !account.id) {
        console.log('no channel or account id', channel,)
        return;
      }
      const index = findIndex(account.channels, ['url', channel.url]);
      const copy = [...account.channels];
      copy.splice(index, 1);
      account.channels = copy;
      state.accounts[state.selectedAccountIdx] = account;

      supabaseClient
        .from('accounts_to_channel')
        .delete()
        .eq('account_id', account.id)
        .eq('channel_id', channel.id)
        .then(({ error, data }) => {
          // console.log('response - data', data, 'error', error);
        });
    })
  },
  addChannel: ({ name, url, iconUrl, account }: AddChannelProps) => {
    set(async (state) => {
      return await supabaseClient
        .from('channel')
        .insert({
          name,
          url,
          icon_url: iconUrl,
          source: `${account} via herocast`,
        })
        .select()
        .then(({ error, data }) => {
          // console.log('response - data', data, 'error', error);
          if (!data || error) return;

          state.allChannels = [...state.allChannels, data[0]];

          const account = state.accounts[state.selectedAccountIdx];
          const idx = account.channels.length
          state.addPinnedChannel({ ...data[0], idx });
        });
    });
  },
  updatedPinnedChannelIndices: async ({ oldIndex, newIndex }: UpdatedPinnedChannelIndicesProps) => {
    set((state) => {
      const account = state.accounts[state.selectedAccountIdx];
      const accountId = account.id;
      const channels = account.channels;
      const newChannels = cloneDeep(account.channels);

      console.log(`moving channel ${channels[oldIndex].name} to index ${newIndex}`);

      supabaseClient
        .from('accounts_to_channel')
        .update({ index: newIndex })
        .eq('account_id', accountId)
        .eq('channel_id', channels[oldIndex].id)
        .select('*, channel(*)')
        .then(({ error }) => {
          if (error) {
            console.log('failed to update channel', channels[oldIndex].id)
            return;
          }
        });
      newChannels[newIndex] = cloneDeep(channels[oldIndex]);
      newChannels[newIndex].idx = newIndex;
      const nrUpdates = Math.abs(oldIndex - newIndex);

      for (let i = 0; i < nrUpdates; i++) {
        const from = oldIndex > newIndex ? newIndex + i : oldIndex + i + 1;
        const to = oldIndex > newIndex ? newIndex + i + 1 : oldIndex + i;
        console.log(`moving channel ${channels[from].name} to index ${to}`);

        newChannels[to] = cloneDeep(channels[from]);
        newChannels[to].idx = to;

        supabaseClient
          .from('accounts_to_channel')
          .update({ index: to })
          .eq('account_id', accountId)
          .eq('channel_id', channels[from].id)
          .select('*, channel(*)')
          .then(({ error }) => {
            if (error) {
              console.log('failed to update channel', channels[oldIndex].id)
              return;
            }
          });
      }
      state.accounts[state.selectedAccountIdx] = { ...account, ...{ channels: newChannels } };
    });
  }
});
export const useAccountStore = create<AccountStore>()(devtools(mutative(store)));

const fetchAllChannels = async (): Promise<ChannelType[]> => {
  let channelData = [];
  let hasMoreChannels = false;
  console.log('fetching existing channels in DB');
  do {
    const start = channelData.length;
    const end = start + 999;
    const { data, error, count } = await supabaseClient
      .from('channel')
      .select('*', { count: 'exact' })
      .range(start, end);

    if (error) throw error;
    channelData = channelData.concat(data);
    hasMoreChannels = data.length > 0;
  } while (hasMoreChannels);
  return channelData || [];
}

export const hydrate = async () => {
  if (useAccountStore.getState().hydrated) {
    useAccountStore.getState().resetStore();
  }
  
  console.log('hydrating 💦');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no account to hydrate');
    return;
  }

  const { data: accountData, error: accountError } = await supabaseClient
    .from('decrypted_accounts')
    .select('*, accounts_to_channel(*, channel(*))')
    .eq('user_id', user?.id)
    .neq('status', AccountStatusType.removed)
    .order('created_at', { ascending: true });

  if (accountError) {
    console.error('error hydrating account store', accountError);
    return;
  }

  let accountsForState: AccountObjectType[] = [];
  if (accountData.length === 0) {
    console.log('no accounts found');
  } else {
    accountsForState = accountData.map((account) => {
      // console.log('channels for account', account.name, account.accounts_to_channel);
      const channels: AccountChannelType[] = sortBy(account.accounts_to_channel, 'index').map((accountToChannel) => ({
        idx: accountToChannel.index,
        lastRead: accountToChannel.last_read,
        id: accountToChannel.channel_id,
        name: accountToChannel.channel.name,
        url: accountToChannel.channel.url,
        icon_url: accountToChannel.channel.icon_url,
        source: accountToChannel.channel.source,
      }));
      return {
        id: account.id,
        name: account.name,
        status: account.status,
        publicKey: account.public_key,
        platform: account.platform,
        platformAccountId: account.platform_account_id,
        createdAt: account.created_at,
        data: account.data,
        privateKey: account.decrypted_private_key,
        channels: channels,
      }
    })
  }

  const allChannels = await fetchAllChannels();
  console.log('loaded all channels: ', allChannels.length)
  useAccountStore.setState({
    ...useAccountStore.getState(),
    allChannels,
    accounts: accountsForState,
    selectedAccountIdx: 0,
    hydrated: true
  });
  console.log('done hydrating 🌊 happy casting')
}

const switchAccountTo = (idx: number) => {
  if (idx < 0) return;

  const store = useAccountStore.getState();
  if (idx > store.accounts.length) return;
  store.setCurrentAccountIdx(idx);
};

const getAccountCommands = () => {
  const accountCommands: CommandType[] = [];

  for (let i = 0; i < 9; i++) {
    accountCommands.push({
      name: `Switch to account ${i + 1}`,
      aliases: [`account ${i + 1}`],
      shortcut: `ctrl+${i + 1}`,
      action: () => {
        switchAccountTo(i);
      },
      options: {
        enableOnContentEditable: true,
        enableOnFormTags: true,
      },
      enabled: () => useAccountStore.getState().accounts.length > i &&
        useAccountStore.getState().accounts[i].status === AccountStatusType.active,
    });
  }

  return accountCommands;
};

const getChannelCommands = () => {
  const channelCommands: CommandType[] = [];

  channelCommands.push({
    name: `Switch to follow feed`,
    aliases: ['follow feed', 'following', 'feed', 'home'],
    shortcut: 'shift+0',
    options: {
      enableOnFormTags: false,
    },
    navigateTo: '/feed',
    action: () => {
      useAccountStore.getState().resetSelectedChannel();
    },
  });

  for (let i = 0; i < 9; i++) {
    channelCommands.push({
      name: `Switch to channel ${i + 1}`,
      aliases: [],
      shortcut: `shift+${i + 1}`,
      options: {
        enableOnFormTags: false,
      },
      navigateTo: '/feed',
      action: () => {
        const { accounts, selectedAccountIdx } = useAccountStore.getState();
        const channels = accounts[selectedAccountIdx]?.channels;

        if (isEmpty(channels) || channels.length <= i) return;

        const state = useAccountStore.getState();
        state.setSelectedChannelUrl(channels[i].url);
      },
    });
  }

  channelCommands.push(...[{
    name: `Switch to random channel`,
    aliases: ['random', 'lucky', 'discover'],
    navigateTo: '/feed',
    action: () => {
      const state = useAccountStore.getState();
      if (isEmpty(state.allChannels)) return;
      const randomIndex = randomNumberBetween(0, state.allChannels.length - 1);
      state.setSelectedChannelUrl(state.allChannels[randomIndex].url);
    },
  },
  {
    name: 'Switch to next channel',
    aliases: ['next', 'forward'],
    shortcut: 'shift+j',
    navigateTo: '/feed',
    action: () => {
      const state = useAccountStore.getState();
      const channels = state.accounts[state.selectedAccountIdx]?.channels;
      if (isEmpty(channels)) return;
      const currentIdx = getCurrentChannelIndex(state.selectedChannelUrl, channels);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= channels.length) return;
      
      if (nextIdx === 1) {
        state.setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING)
      } else {
        state.setSelectedChannelUrl(channels[nextIdx - CUSTOM_CHANNEL_COUNT].url);
      }
    },
  }, {
    name: 'Switch to previous channel',
    aliases: ['previous', 'back'],
    shortcut: 'shift+k',
    navigateTo: '/feed',
    action: () => {
      const state = useAccountStore.getState();
      const channels = state.accounts[state.selectedAccountIdx]?.channels;
      if (isEmpty(channels)) return;

      const currentIdx = getCurrentChannelIndex(state.selectedChannelUrl, channels);
      const previousIdx = currentIdx - 1;
      if (previousIdx < -1) return;

      if (previousIdx === 1) {
        state.setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING)
      } else if (previousIdx === 0) {
        state.setSelectedChannelUrl(CUSTOM_CHANNELS.FOLLOWING);
      } else if (previousIdx === -1) {
        state.resetSelectedChannel();
      } else {
        state.setSelectedChannelUrl(channels[previousIdx - CUSTOM_CHANNEL_COUNT].url);
      }
    },
  },
  ]);

  return channelCommands;
}

const getCurrentChannelIndex = (channelUrl: string, channels) => {
  const customChannelIdx = CUSTOM_CHANNEL_TO_IDX[channelUrl];
  if (customChannelIdx !== undefined) return customChannelIdx;

  const currentIdx = channels.findIndex((channel) => channel.url === channelUrl);
  return currentIdx + CUSTOM_CHANNEL_COUNT;
}

export const accountCommands = getAccountCommands();
export const channelCommands = getChannelCommands();

// client-side-only
if (typeof window !== 'undefined') {
  hydrate();
}
