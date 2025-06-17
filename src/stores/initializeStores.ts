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
  
  // Track performance of critical initialization path
  performance.mark('store-init-start');

  // Phase 1: Critical path - minimal data for basic functionality
  console.log('Phase 1: Loading critical data 🚀');
  performance.mark('phase1-start');
  await Promise.all([
    useAccountStore.getState().hydrateMinimal(),
    useDraftStore.getState().hydrate(), // Drafts are quick to load
  ]);
  performance.mark('phase1-end');
  performance.measure('store-init-phase1', 'phase1-start', 'phase1-end');

  console.log('Phase 1 complete - UI can be interactive! ✨');

  // Phase 2: Background enhancement - full feature loading
  console.log('Phase 2: Loading complete data in background 🌊');
  performance.mark('phase2-start');
  Promise.all([
    useAccountStore.getState().hydrateComplete(),
    useListStore.getState().hydrate(),
    useUserStore.getState().hydrate(),
  ])
    .then(() => {
      performance.mark('phase2-end');
      performance.mark('store-init-end');
      performance.measure('store-init-phase2', 'phase2-start', 'phase2-end');
      performance.measure('store-init-total', 'store-init-start', 'store-init-end');
      
      // Log performance metrics to console
      const phase1Duration = performance.getEntriesByName('store-init-phase1')[0]?.duration;
      const phase2Duration = performance.getEntriesByName('store-init-phase2')[0]?.duration;
      const totalDuration = performance.getEntriesByName('store-init-total')[0]?.duration;
      
      console.log('🎉 Phase 2 complete - Full functionality available!');
      console.log(`⚡ Performance: Phase 1: ${phase1Duration?.toFixed(1)}ms, Phase 2: ${phase2Duration?.toFixed(1)}ms, Total: ${totalDuration?.toFixed(1)}ms`);
    })
    .catch((error) => {
      console.error('Phase 2 background loading failed:', error);
    });

  console.log('Progressive initialization started - returning control to UI');
};
