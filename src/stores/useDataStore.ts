import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { UserNeynarV1Type } from "@/common/helpers/neynar";


type addUserProfileProps = {
  username: string;
  data: UserNeynarV1Type;
};

interface DataStoreProps {
  usernameToData: Record<string, UserNeynarV1Type>;
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

