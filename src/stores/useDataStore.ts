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
  usernameToFid: Record<string, number>;
  fidToData: Record<number, UserProfile>;
  tokenSymbolToData: Record<string, DexPair>;
}

interface DataStoreActions {
  updateSelectedCast: (cast?: CastWithInteractions) => void;
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
  usernameToFid: {},
  fidToData: {},
  tokenSymbolToData: {},
  updateSelectedCast: (cast?: CastWithInteractions) => {
    set((state) => {
      state.selectedCast = cast;
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
      
      users.forEach(user => {
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
  fetchBulkProfiles: async (fids: number[], viewerFid: string, skipAdditionalInfo: boolean = true): Promise<UserProfile[]> => {
    if (fids.length === 0) return [];

    const currentState = get();
    const uncachedFids: number[] = [];
    const cachedProfiles: UserProfile[] = [];
    
    // Check cache for existing profiles
    fids.forEach(fid => {
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

    // Dynamically import NeynarAPIClient to avoid circular dependencies
    const { NeynarAPIClient } = await import('@neynar/nodejs-sdk');
    const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
    const fetchedProfiles: UserProfile[] = [];
    const batchSize = 50;
    
    // Batch fetch uncached profiles
    for (let i = 0; i < uncachedFids.length; i += batchSize) {
      const batch = uncachedFids.slice(i, i + batchSize);
      
      try {
        const response = await neynarClient.fetchBulkUsers(batch, {
          viewerFid: parseInt(viewerFid),
        });
        
        if (response.users) {
          // Add basic profiles to store immediately
          const addUserProfiles = get().addUserProfiles;
          addUserProfiles(response.users);
          
          // Create UserProfile objects
          const userProfiles = response.users.map(user => ({
            ...user,
            updatedAt: Date.now(),
          }));
          
          fetchedProfiles.push(...userProfiles);
          
          // Fetch additional info if requested
          if (!skipAdditionalInfo) {
            await Promise.all(
              response.users.map(async (user) => {
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
              })
            );
          }
        }
      } catch (error) {
        console.error(`Failed to fetch batch of profiles:`, error);
      }
    }

    // Return combined results
    return [...cachedProfiles, ...fetchedProfiles];
  },
});

export const useDataStore = create<DataStore>()(devtools(mutative(store)));
