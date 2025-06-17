import { useAccountStore } from './useAccountStore';
import { useListStore } from './useListStore';
import { useDraftStore } from './useDraftStore';
import { useUserStore } from './useUserStore';
import { startTiming, endTiming } from './usePerformanceStore';

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
  const totalTimingId = startTiming('store-init-total');
  const phase1TimingId = startTiming('store-init-phase1');

  // Phase 1: Critical path - minimal data for basic functionality
  console.log('Phase 1: Loading critical data 🚀');
  await Promise.all([
    useAccountStore.getState().hydrateMinimal(),
    useDraftStore.getState().hydrate(), // Drafts are quick to load
  ]);

  const phase1Duration = endTiming(phase1TimingId, 1000); // Target: <1s for critical path
  console.log('Phase 1 complete - UI can be interactive! ✨');

  // Phase 2: Background enhancement - full feature loading
  console.log('Phase 2: Loading complete data in background 🌊');
  const phase2TimingId = startTiming('store-init-phase2');

  Promise.all([
    useAccountStore.getState().hydrateComplete(),
    useListStore.getState().hydrate(),
    useUserStore.getState().hydrate(),
  ])
    .then(() => {
      const phase2Duration = endTiming(phase2TimingId, 3000); // Target: <3s for full load
      const totalDuration = endTiming(totalTimingId, 4000); // Target: <4s total

      console.log('🎉 Phase 2 complete - Full functionality available!');
      console.log(
        `⚡ Performance: Phase 1: ${phase1Duration?.toFixed(1)}ms, Phase 2: ${phase2Duration?.toFixed(1)}ms, Total: ${totalDuration?.toFixed(1)}ms`
      );
    })
    .catch((error) => {
      console.error('Phase 2 background loading failed:', error);
    });

  console.log('Progressive initialization started - returning control to UI');
};
