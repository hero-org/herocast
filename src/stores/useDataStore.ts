/* eslint-disable @typescript-eslint/no-unsafe-call */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CastWithInteractions, User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import get from "lodash.get";
import { Analytics } from "@/common/types/types";

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

type addUserProfileProps = {
  user: User;
};

type addTokenDataProps = {
  tokenSymbol: string;
  data: DexPair;
};

type UserProfile = User & { updatedAt: number };


interface DataStoreProps {
  selectedCast?: CastWithInteractions;
  usernameToFid: Record<string, number>;
  fidToData: Record<number, UserProfile>,
  tokenSymbolToData: Record<string, DexPair>;
  fidToAnalytics: Record<number, Analytics>;
}

interface DataStoreActions {
  updateSelectedCast: (cast?: CastWithInteractions) => void;
  addUserProfile: ({ user }: addUserProfileProps) => void;
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => void;
  addAnalytics: (fid: number, analytics: Analytics) => void;
}

export interface DataStore extends DataStoreProps, DataStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DataStore>) => void) => void;

const store = (set: StoreSet) => ({
  selectedCast: null,
  usernameToFid: {},
  fidToData: {},
  tokenSymbolToData: {},
  fidToAnalytics: {},
  updateSelectedCast: (cast?: CastWithInteractions) => {
    set((state) => {
      state.selectedCast = cast;
    });
  },
  addUserProfile: ({ user }: addUserProfileProps) => {
    set((state) => {
      state.usernameToFid = { ...state.usernameToFid, ...{ [user.username]: user.fid } };
      const userObject = { ...user, updatedAt: Date.now() };
      state.fidToData = { ...state.fidToData, ...{ [user.fid]: userObject } };
    });
  },
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => {
    set((state) => {
      state.tokenSymbolToData = { ...state.tokenSymbolToData, ...{ [tokenSymbol]: data } };
    });
  },
  addAnalytics: (fid: number, analytics: Analytics) => {
    set((state) => {
      state.fidToAnalytics = {
        ...state.fidToAnalytics, ...{ [fid]: { ...state.fidToAnalytics[fid], ...analytics } }
      };
    });
  }
});
export const useDataStore = create<DataStore>()(devtools(mutative(store)));

export const getProfile = (dataStoreState: DataStore, username?: string, fid?: string) => {
  if (username) {
    return get(
      dataStoreState.fidToData,
      get(dataStoreState.usernameToFid, username)
    );
  } else if (fid) {
    return get(dataStoreState.fidToData, fid);
  }
};

export const shouldUpdateProfile = (profile?: UserProfile) => {
  return !profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL
};