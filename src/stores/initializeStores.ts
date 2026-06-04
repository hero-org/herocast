import { useAccountStore } from './useAccountStore';
import { useDraftStore } from './useDraftStore';
import { useListStore } from './useListStore';
import { useNotificationStore } from './useNotificationStore';
import { endTiming, startTiming } from './usePerformanceStore';
import { useUserSettingsStore } from './useUserSettingsStore';
import { useUserStore } from './useUserStore';
import { useWorkspaceStore } from './useWorkspaceStore';

export const initializeStores = async () => {
  // console.log('Start initializing stores 🤩')
  await Promise.all([
    useUserStore.getState().hydrate(),
    useAccountStore.getState().hydrate(),
    useListStore.getState().hydrate(),
    useDraftStore.getState().hydrate(),
    useNotificationStore.getState().hydrate(),
    useWorkspaceStore.getState().hydrate(),
    useUserSettingsStore.getState().hydrate(),
  ]);
  // console.log('Done initializing stores 🤩')
};

export const initializeStoresProgressive = async () => {
  console.log('Start progressive store initialization ⚡');

  // Track performance of critical initialization path
  const totalTimingId = startTiming('store-init-total');
  const phase1TimingId = startTiming('store-init-phase1');

  // Phase 1: Critical path - local only. Rehydrate the account store from
  // IndexedDB and flip its UI gate so the app shell + skeletons paint
  // immediately. No Supabase round-trips happen here.
  console.log('Phase 1: Loading critical data 🚀');
  await useAccountStore.getState().hydrateMinimal();

  const phase1Duration = endTiming(phase1TimingId, 300); // Target: <300ms, local rehydrate only
  console.log('Phase 1 complete - UI can be interactive! ✨');

  // Phase 2: Background enhancement - every blocking Supabase round-trip runs
  // here, off the critical path. The UI is already interactive and updates
  // reactively as each store resolves.
  console.log('Phase 2: Loading complete data in background 🌊');
  const phase2TimingId = startTiming('store-init-phase2');

  Promise.all([
    useAccountStore.getState().hydrateComplete(),
    useDraftStore.getState().hydrate(),
    useNotificationStore.getState().hydrate(),
    useListStore.getState().hydrate(),
    useUserStore.getState().hydrate(),
    useWorkspaceStore.getState().hydrate(),
    useUserSettingsStore.getState().hydrate(),
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
