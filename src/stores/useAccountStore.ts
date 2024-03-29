import { AccountPlatformType, AccountStatusType } from "../../src/common/constants/accounts";
import { ChannelType } from "../../src/common/constants/channels";
import { CommandType } from "../../src/common/constants/commands";
import { randomNumberBetween } from "../../src/common/helpers/math";
import { getAccountsForUser } from "../../src/common/helpers/supabase";
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import isEmpty from "lodash.isempty";
import findIndex from 'lodash.findindex';
import sortBy from "lodash.sortby";
import cloneDeep from "lodash.clonedeep";
import { UUID } from "crypto";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { createClient } from "@/common/helpers/supabase/component";
import includes from "lodash.includes";
import uniqBy from "lodash.uniqby";
import { v4 as uuidv4 } from 'uuid';
import { getUsernameForFid } from "@/common/helpers/farcaster";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);
const TIMEDELTA_REHYDRATE = 1000 * 60 * 60 * 12; // 12 hrs;

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
const DEFAULT_LOCAL_ACCOUNT_CHANNELS = [
  "Farcaster",
  "herocast",
  "Base",
  "Founders",
  "Product",
  "EVM",
  "GM",
  "dev"
];
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

type AddAccountProps = {
  account: Omit<AccountObjectType, 'channels' | 'id'> & { privateKey?: string };
  localOnly?: boolean;
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
  publicKey?: `0x${string}`;
  platform: AccountPlatformType;
  platformAccountId?: string;
  privateKey?: `0x${string}`;
  createdAt?: string;
  data?: { deeplinkUrl?: string, signerToken?: string };
  channels: AccountChannelType[];
  user?: User;
}

interface AccountStoreProps {
  selectedAccountIdx: number;
  selectedChannelUrl: string;
  accounts: AccountObjectType[];
  allChannels: ChannelType[];
  hydratedAt?: number; // timestamp
}

interface AccountStoreActions {
  addAccount: (props: AddAccountProps) => void;
  addChannel: (props: AddChannelProps) => void;
  updatedPinnedChannelIndices: ({ oldIndex, newIndex }: UpdatedPinnedChannelIndicesProps) => void;
  setAccountActive: (accountId: UUID, name: string, data: { platform_account_id: string, data?: object }) => void;
  updateAccountUsername: (accountId: UUID) => void;
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
};

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get,
  );

type StoreSet = (fn: (draft: Draft<AccountStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  ...initialState,
  addAccount: async (props: AddAccountProps) => {
    const { account, localOnly } = props;

    if (localOnly) {
      set((state) => {
        const channels = state.allChannels.filter((channel) => includes(DEFAULT_LOCAL_ACCOUNT_CHANNELS, channel.name));
        const accountChannels = channels.map((channel, idx) => ({ ...channel, idx }));
        state.accounts.push({ ...account, ...{ channels: accountChannels }, ...{ id: uuidv4() } });
      });
      return;
    } else {
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
          // console.log('response - data', data, 'error', error);

          if (!data || error) return;
          set((state) => {
            state.accounts.push({ ...account, ...{ id: data[0].id } });
          });
        })
    }
    console.log('----> addAccount done')
  },
  setAccountActive: async (accountId: UUID, name: string, data: { platform_account_id: string, data?: object }) => {
    set(async (state) => {
      const { error } = await supabaseClient
        .from('accounts')
        .update({ name, status: AccountStatusType.active, ...data })
        .eq('id', accountId)
        .select()

      // console.log('response setAccountActive - data', data, 'error', error);
      if (!error) {
        const accountIndex = state.accounts.findIndex((account) => account.id === accountId);
        const account = state.accounts[accountIndex];
        account.status = AccountStatusType.active;
        state.accounts[accountIndex] = account;
      }
      console.log('-----> setAcountActive done')
    });
  },
  updateAccountUsername: async (accountId: UUID) => {
    set(async (state) => {
      const accountIndex = state.accounts.findIndex((account) => account.id === accountId);
      const account = state.accounts[accountIndex];

      try {
        const fid = account.platformAccountId;
        if (fid && account.status === "active") {
          const username = await getUsernameForFid(Number(fid));
          if (username && username !== account.name) {
            const { data, error } = await supabaseClient
              .from('accounts')
              .update({ name: username })
              .eq('id', accountId)
              .select();

            // console.log('response updateAccountUsername - data', data, 'error', error);
            if (!error) {
              account.name = username;
              state.accounts[accountIndex] = account;
            }
          }
        }
      } catch (error) {
        console.error("Failed to sync account name from protocol to DB", error);
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
          // console.log('response removeAccount - data', data, 'error', error);
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

      if (account.platform !== AccountPlatformType.farcaster_local_readonly) {
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
      }
    })
  },
  removePinnedChannel: (channel: ChannelType) => {
    set((state) => {
      const account = state.accounts[state.selectedAccountIdx];

      if (!channel) {
        console.log('no channel or account id', channel,)
        return;
      }
      const index = findIndex(account.channels, ['url', channel.url]);
      const copy = [...account.channels];
      copy.splice(index, 1);
      account.channels = copy;
      state.accounts[state.selectedAccountIdx] = account;

      if (account.platform !== AccountPlatformType.farcaster_local_readonly) {
        supabaseClient
          .from('accounts_to_channel')
          .delete()
          .eq('account_id', account.id)
          .eq('channel_id', channel.id)
          .then(({ error, data }) => {
            // console.log('response - data', data, 'error', error);
          });
      }
    })
  },
  addChannel: ({ name, url, iconUrl, account }: AddChannelProps) => {
    set(async (state) => {
      await supabaseClient
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

      // console.log(`moving channel ${channels[oldIndex].name} to index ${newIndex}`);

      if (account.platform !== AccountPlatformType.farcaster_local_readonly) {
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
      }
      newChannels[newIndex] = cloneDeep(channels[oldIndex]);
      newChannels[newIndex].idx = newIndex;
      const nrUpdates = Math.abs(oldIndex - newIndex);

      for (let i = 0; i < nrUpdates; i++) {
        const from = oldIndex > newIndex ? newIndex + i : oldIndex + i + 1;
        const to = oldIndex > newIndex ? newIndex + i + 1 : oldIndex + i;
        // console.log(`moving channel ${channels[from].name} to index ${to}`);

        newChannels[to] = cloneDeep(channels[from]);
        newChannels[to].idx = to;
        if (account.platform !== AccountPlatformType.farcaster_local_readonly) {
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
      }
      state.accounts[state.selectedAccountIdx] = { ...account, ...{ channels: newChannels } };
    });
  }
});

export const useAccountStore = create<AccountStore>()(persist(mutative(store),
  {
    'name': 'herocast-accounts-store',
    storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    partialize: (state) => ({
      allChannels: state.allChannels,
      accounts: state.accounts.map((account) => {
        const { privateKey, ...rest } = account;
        return rest;
      }),
      hydratedAt: state.hydratedAt,
    }),
    // onRehydrateStorage: (state) => {
    // console.log('onRehydrateStorage hydration starts', state);
    // run after hydrate
    // return (state, error) => {
    //   if (error) {
    //     // console.log('onRehydrateStorage an error happened during hydration', error)
    //   } else {
    //     console.log('onRehydrateStorage hydration finished', state)
    //   }
    // }
    // },
  }));

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
  console.log('done fetching channels in DB', channelData.length);
  return channelData || [];
}

const hydrateAccounts = async (): Promise<AccountObjectType[]> => {
  console.log('hydrating accounts 🌊');
  const accountData = await getAccountsForUser(supabaseClient);
  let accounts: AccountObjectType[] = [];
  if (accountData.length === 0) {
    console.log('no accounts found');
  } else {
    accounts = accountData.map((account) => {
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
    // get pfpUrl for each account based on platformAccountId which is fid
    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    const fids = accounts.map((account) => Number(account.platformAccountId!));
    const users = (await neynarClient.fetchBulkUsers(fids, { viewerFid: APP_FID })).users;
    accounts = accounts.map((account) => {
      const user = users.find((user) => user.fid === Number(account.platformAccountId));
      if (user) {
        account.user = user;
      }
      return account;
    });
  }

  const localOnlyAccounts = useAccountStore.getState().accounts.filter((account) => account.platform === AccountPlatformType.farcaster_local_readonly);
  console.log('done hydrating accounts 🌊');
  return [...accounts, ...uniqBy(localOnlyAccounts, 'platformAccountId')];
}

export const hydrateChannels = async () => {
  console.log('hydrating channels 🌊');
  const state = useAccountStore.getState();

  let allChannels: ChannelType[] = state.allChannels;
  let hydratedAt = state.hydratedAt;

  const shouldRehydrate = !allChannels.length || !state.hydratedAt || Date.now() - state.hydratedAt > TIMEDELTA_REHYDRATE;
  if (shouldRehydrate) {
    allChannels = await fetchAllChannels();
    hydratedAt = Date.now();
  }

  useAccountStore.setState({
    ...state,
    allChannels,
    hydratedAt,
  });
  console.log('done hydrating channels 🌊');
}

export const hydrate = async () => {
  console.log('hydrating 💦');

  const accounts = await hydrateAccounts();
  await hydrateChannels();

  useAccountStore.setState({
    ...useAccountStore.getState(),
    accounts
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
  const channelCommands: CommandType[] = [{
    name: `Switch to follow feed`,
    aliases: ['following', 'feed', 'home'],
    shortcut: 'shift+0',
    options: {
      enableOnFormTags: false,
    },
    navigateTo: '/feed',
    action: () => {
      useAccountStore.getState().setSelectedChannelUrl(CUSTOM_CHANNELS.FOLLOWING);
    },
  },
  {
    name: `Switch to trending feed`,
    aliases: ['trending', 'popular'],
    shortcut: 'shift+1',
    options: {
      enableOnFormTags: false,
    },
    navigateTo: '/feed',
    action: () => {
      useAccountStore.getState().setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING);
    },
  }];

  for (let i = 0; i < 8; i++) {
    channelCommands.push({
      name: `Switch to channel ${i + 2}`,
      aliases: [],
      shortcut: `shift+${i + 2}`,
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
