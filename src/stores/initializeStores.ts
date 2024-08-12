import { useAccountStore } from "./useAccountStore";
import { useListStore } from "./useListStore";
import { useDraftStore } from "./useDraftStore";
import { useUserStore } from "./useUserStore";

export const initializeStores = async () => {
    // console.log('Start initializing stores 🤩')
    await Promise.all([
        useUserStore.getState().hydrate(),
        useAccountStore.getState().hydrate(),
        useListStore.getState().hydrate(),
        useDraftStore.getState().hydrate(),
    ]);
    // console.log('Done initializing stores 🤩')
};
