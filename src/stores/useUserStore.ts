import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { Customer } from "@/common/types/database.types";
import { createClient } from "@/common/helpers/supabase/component";
import { getCustomersForUser } from "@/common/helpers/supabase";


interface UserStoreProps {
  customer: Customer | undefined,
}

interface UserStoreActions {
  hydrate: () => void;
  addCustomer: () => void;
}

export interface UserStore extends UserStoreProps, UserStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<UserStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  customer: undefined,
  addCustomer: (customer: Customer) => {
    set((state) => {
      state.customer = customer;
    });
  },
  hydrate: async () => {
    console.log('hydrate userStore');
    getCustomersForUser(supabaseClient).then((customer) => {
      if (!customer) {
        return;
      }

      set((state) => {
        state.customer = customer;
      });
    });
  },
});

export const useUserStore = create<UserStore>()(devtools(mutative(store)));

export const isPaidUser = () => {
  return useUserStore((state) => state.customer) !== undefined;
}