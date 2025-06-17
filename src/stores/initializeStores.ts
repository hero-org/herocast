import { useAccountStore } from './useAccountStore';
import { useListStore } from './useListStore';
import { useDraftStore } from './useDraftStore';
import { useUserStore } from './useUserStore';

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

export const initializeStoresProgressive = async () => {
  console.log('Start progressive store initialization ⚡');
  
  // Phase 1: Critical path - minimal data for basic functionality
  console.log('Phase 1: Loading critical data 🚀');
  await Promise.all([
    useAccountStore.getState().hydrateMinimal(),
    useDraftStore.getState().hydrate(), // Drafts are quick to load
  ]);
  
  console.log('Phase 1 complete - UI can be interactive! ✨');
  
  // Phase 2: Background enhancement - full feature loading
  console.log('Phase 2: Loading complete data in background 🌊');
  Promise.all([
    useAccountStore.getState().hydrateComplete(),
    useListStore.getState().hydrate(),
    useUserStore.getState().hydrate(),
  ]).then(() => {
    console.log('Phase 2 complete - Full functionality available! 🎉');
  }).catch((error) => {
    console.error('Phase 2 background loading failed:', error);
  });
  
  console.log('Progressive initialization started - returning control to UI');
};
