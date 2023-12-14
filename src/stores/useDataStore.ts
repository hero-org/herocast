import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v1";


type addUserProfileProps = {
  username: string;
  data: User;
};

interface DataStoreProps {
  usernameToData: Record<string, User>;
}

interface DataStoreActions {
  addUserProfile: ({ username, data }: addUserProfileProps) => void;
}

export interface DataStore extends DataStoreProps, DataStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DataStore>) => void) => void;

const store = (set: StoreSet) => ({
  usernameToData: {},
  addUserProfile: ({ username, data }: addUserProfileProps) => {
    set((state) => {
      state.usernameToData = { ...state.usernameToData, ...{ [username]: data } };
    });
  },
});
export const useDataStore = create<DataStore>()(devtools(mutative(store)));

