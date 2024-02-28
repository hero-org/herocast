import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";


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
  username: string;
  data: User;
};

type addTokenDataProps = {
  tokenSymbol: string;
  data: DexPair;
};

interface DataStoreProps {
  usernameToData: Record<string, User>;
  tokenSymbolToData: Record<string, DexPair>;
}

interface DataStoreActions {
  addUserProfile: ({ username, data }: addUserProfileProps) => void;
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => void;
}

export interface DataStore extends DataStoreProps, DataStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DataStore>) => void) => void;

const store = (set: StoreSet) => ({
  usernameToData: {},
  tokenSymbolToData: {},
  addUserProfile: ({ username, data }: addUserProfileProps) => {
    set((state) => {
      state.usernameToData = { ...state.usernameToData, ...{ [username]: data } };
    });
  },
  addTokenData: ({ tokenSymbol, data }: addTokenDataProps) => {
    set((state) => {
      state.tokenSymbolToData = { ...state.tokenSymbolToData, ...{ [tokenSymbol]: data } };
    });
  }
});
export const useDataStore = create<DataStore>()(devtools(mutative(store)));

