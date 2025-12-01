/* eslint-disable @typescript-eslint/no-unsafe-call */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { create as mutativeCreate, Draft } from 'mutative';
import { CastWithInteractions, User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { IcebreakerSocialInfo } from '@/common/helpers/icebreaker';
import { AnalyticsData } from '@/common/types/types';
import { CoordinapeAttestation } from '@/common/helpers/coordinapeAttestations';

export const PROFILE_UPDATE_INTERVAL = 1000 * 60 * 5; // 5 minutes

type TokenInfo = {
  imageUrl: string;
  websites: Array<{
    label: string;
    url: string;
  }>;
};

type Token = {
  address: string;
  name: string;
  symbol: string;
};

type Transactions = {
  m5: {
    buys: number;
    sells: number;
  };
  h1: {
    buys: number;
    sells: number;
  };
  h6: {
    buys: number;
    sells: number;
  };
  h24: {
    buys: number;
    sells: number;
  };
};

type Volume = {
  h24: number;
  h6: number;
  h1: number;
  m5: number;
};

export type PriceChange = {
  m5: number;
  h1: number;
  h6: number;
  h24: number;
};

type Liquidity = {
  usd: number;
  base: number;
  quote: number;
};

export type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: Token;
  quoteToken: Token;
  priceNative: string;
  priceUsd: string;
  txns: Transactions;
  volume: Volume;
  priceChange: PriceChange;
  liquidity: Liquidity;
  fdv: number;
  pairCreatedAt: number;
  info: TokenInfo;
};

type addTokenDataProps = {
  tokenSymbol: string;
  data: DexPair;
};

type AdditionalUserInfo = {
  icebreakerSocialInfo: IcebreakerSocialInfo;
  coordinapeAttestations: CoordinapeAttestation[];
};

type addUserProfileProps = {
  user: User & Partial<AdditionalUserInfo>;
};

export type UserProfile = User & { updatedAt: number } & Partial<AdditionalUserInfo>;

interface DataStoreProps {
  selectedCast?: CastWithInteractions;
  selectedProfileFid?: number;
  usernameToFid: Record<string, number>;
  fidToData: Record<number, UserProfile>;
  tokenSymbolToData: Record<string, DexPair>;
}

interface DataStoreActions {
  updateSelectedCast: (cast?: CastWithInteractions) => void;
  updateSelectedProfileFid: (fid?: number) => void;
  addUserProfile: ({ user }: addUserProfileProps) => void;
  addUserProfiles: (users: User[]) => void;
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => void;
  addAnalytics: (fid: number, analytics: AnalyticsData) => void;
  fetchBulkProfiles: (fids: number[], viewerFid: string, skipAdditionalInfo?: boolean) => Promise<UserProfile[]>;
}

export interface DataStore extends DataStoreProps, DataStoreActions {}

export const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DataStore>) => void) => void;

// Helper function to check if profile needs update
const shouldUpdateProfile = (profile?: UserProfile) => {
  return !profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL;
};

const store = (set: StoreSet, get: () => DataStore) => ({
  selectedCast: null,
  selectedProfileFid: undefined,
  usernameToFid: {},
  fidToData: {},
  tokenSymbolToData: {},
  updateSelectedCast: (cast?: CastWithInteractions) => {
    set((state) => {
      state.selectedCast = cast;
    });
  },
  updateSelectedProfileFid: (fid?: number) => {
    set((state) => {
      state.selectedProfileFid = fid;
    });
  },
  addUserProfile: async ({ user }: addUserProfileProps) => {
    set((state) => {
      state.usernameToFid = {
        ...state.usernameToFid,
        ...{ [user.username]: user.fid },
      };
      const userObject = {
        ...user,
        updatedAt: Date.now(),
      };
      state.fidToData = { ...state.fidToData, ...{ [user.fid]: userObject } };
    });
  },
  addUserProfiles: (users: User[]) => {
    set((state) => {
      const timestamp = Date.now();
      const newUsernameToFid = {};
      const newFidToData = {};

      users.forEach((user) => {
        newUsernameToFid[user.username] = user.fid;
        newFidToData[user.fid] = {
          ...user,
          updatedAt: timestamp,
        };
      });

      state.usernameToFid = { ...state.usernameToFid, ...newUsernameToFid };
      state.fidToData = { ...state.fidToData, ...newFidToData };
    });
  },
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => {
    set((state) => {
      state.tokenSymbolToData = {
        ...state.tokenSymbolToData,
        ...{ [tokenSymbol]: data },
      };
    });
  },
  fetchBulkProfiles: async (
    fids: number[],
    viewerFid: string,
    skipAdditionalInfo: boolean = true
  ): Promise<UserProfile[]> => {
    if (fids.length === 0) return [];

    const currentState = get();
    const uncachedFids: number[] = [];
    const cachedProfiles: UserProfile[] = [];

    // Check cache for existing profiles
    fids.forEach((fid) => {
      const profile = currentState.fidToData[fid];
      if (!profile || shouldUpdateProfile(profile)) {
        uncachedFids.push(fid);
      } else {
        cachedProfiles.push(profile);
      }
    });

    // Return cached profiles if all are fresh
    if (uncachedFids.length === 0) {
      return cachedProfiles;
    }

    const fetchedProfiles: UserProfile[] = [];
    const batchSize = 100; // Maximum batch size for API route

    // Batch fetch uncached profiles with parallel processing
    const batchPromises: Promise<UserProfile[]>[] = [];

    for (let i = 0; i < uncachedFids.length; i += batchSize) {
      const batch = uncachedFids.slice(i, i + batchSize);

      const batchPromise = (async () => {
        try {
          const response = await fetch(`/api/users?fids=${batch.join(',')}&viewer_fid=${viewerFid}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status}`);
          }

          const data = await response.json();
          const users = data.users || [];

          if (users.length > 0) {
            // Add basic profiles to store immediately
            const addUserProfiles = get().addUserProfiles;
            addUserProfiles(users);

            // Create UserProfile objects
            const userProfiles = users.map((user: User) => ({
              ...user,
              updatedAt: Date.now(),
            }));

            // Fetch additional info if requested (in parallel)
            if (!skipAdditionalInfo) {
              const additionalPromises = users.map(async (user: User) => {
                try {
                  const additionalResponse = await fetch(
                    `/api/additionalProfileInfo?fid=${user.fid}&addresses=${user.verified_addresses.eth_addresses}`
                  );
                  if (additionalResponse.ok) {
                    const additionalInfo = await additionalResponse.json();
                    // Update the user with additional info
                    const addUserProfile = get().addUserProfile;
                    addUserProfile({
                      user: {
                        ...user,
                        ...additionalInfo,
                      },
                    });
                  }
                } catch (error) {
                  console.error(`Failed to fetch additional info for FID ${user.fid}:`, error);
                }
              });

              await Promise.all(additionalPromises);
            }

            return userProfiles;
          }
          return [];
        } catch (error) {
          console.error(`Failed to fetch batch of profiles:`, error);
          return [];
        }
      })();

      batchPromises.push(batchPromise);
    }

    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach((profiles) => fetchedProfiles.push(...profiles));

    // Return combined results
    return [...cachedProfiles, ...fetchedProfiles];
  },
});

export const useDataStore = create<DataStore>()(devtools(mutative(store)));
