import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from "mutative";
import { Customer, InsertCustomer } from "@/common/types/database.types";
import { createClient } from "@/common/helpers/supabase/component";
import { addUnsafeCustomerForUser, getCustomersForUser } from "@/common/helpers/supabase";

interface UserStoreProps {
    customer: Customer | undefined;
}

interface UserStoreActions {
    hydrate: () => void;
    addUnsafeCustomerForUser: (customer: Omit<InsertCustomer, "user_id">) => void;
}

export interface UserStore extends UserStoreProps, UserStoreActions {}

export const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<UserStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
    customer: undefined,
    addUnsafeCustomerForUser: async (customer: Omit<InsertCustomer, "user_id">) => {
        addUnsafeCustomerForUser(supabaseClient, customer).then(() => {
            set((state) => {
                state.customer = customer as Customer;
            });
        });
    },
    hydrate: async () => {
        getCustomersForUser(supabaseClient).then((customer) => {
            set((state) => {
                state.customer = customer;
            });
        });
    },
});

export const useUserStore = create<UserStore>()(devtools(mutative(store)));

export const isPaidUser = () => !!useUserStore((state) => state.customer);
