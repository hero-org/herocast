/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from '@/common/constants/commands';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AccountObjectType, useAccountStore } from './useAccountStore';
import { DraftStatus, DraftType, ParentCastIdType } from '@/common/constants/farcaster';
import { formatPlaintextToHubCastMessage, getMentionFidsByUsernames, submitCast } from '@/common/helpers/farcaster';
import { Embed } from '@farcaster/hub-web';
import { AccountPlatformType } from '@/common/constants/accounts';
import {
  toastErrorCastPublish,
  toastInfoReadOnlyMode,
  toastSuccessCastPublished,
  toastSuccessCastScheduled,
} from '@/common/helpers/toast';
import { MAX_THREAD_POSTS, ThreadPublishResult } from '@/common/constants/farcaster';
import { NewPostDraft } from '@/common/constants/postDrafts';
import type { FarcasterEmbed } from '@/common/types/embeds';
import { createClient } from '@/common/helpers/supabase/component';
import { v4 as uuidv4 } from 'uuid';
import uniqBy from 'lodash.uniqby';
import { CastModalView, useNavigationStore } from './useNavigationStore';

const prepareCastBodyForDB = (castBody) => {
  if (castBody.embeds) {
    castBody.embeds.forEach((embed) => {
      if ('castId' in embed && embed.castId) {
        // Hash should already be a hex string - validate and pass through
        const hash = embed.castId.hash;
        if (typeof hash === 'string' && hash.startsWith('0x')) {
          embed.castId = {
            fid: Number(embed.castId.fid),
            hash: hash,
          };
        } else {
          console.error('[prepareCastBodyForDB] Invalid embed castId hash format:', hash);
          throw new Error('Invalid embed castId hash format - expected hex string with 0x prefix');
        }
      }
    });
  }
  return castBody;
};

type PreparedEmbed = { url: string } | { castId: { fid: number; hash: string } };

// Custom type for prepared cast body - uses string hashes for signer service
type PreparedCastBody = {
  text: string;
  embeds?: PreparedEmbed[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentUrl?: string;
  parentCastId?: {
    fid: number;
    hash: string; // Hex string
  };
};

export const prepareCastBody = async (draft: any): Promise<PreparedCastBody> => {
  const castBody = await formatPlaintextToHubCastMessage({
    text: draft.text,
    embeds: draft.embeds || [],
    getMentionFidsByUsernames: getMentionFids,
    parentUrl: draft.parentUrl,
    parentCastFid: draft.parentCastId ? Number(draft.parentCastId.fid) : undefined,
    parentCastHash: draft.parentCastId ? draft.parentCastId.hash : undefined,
  });

  if (!castBody) {
    throw new Error('Failed to prepare cast');
  }

  // Build result with proper types (type is added by submitCast based on isPro)
  const result: PreparedCastBody = {
    text: castBody.text,
    embeds: castBody.embeds,
    mentions: castBody.mentions,
    mentionsPositions: castBody.mentionsPositions,
    parentUrl: castBody.parentUrl,
  };

  if (castBody.parentCastId) {
    // Validate hash format - it should be a hex string at this point
    const hash = castBody.parentCastId.hash;
    let hashString: string;

    if (typeof hash === 'string') {
      hashString = hash;
    } else if (hash instanceof Uint8Array) {
      // Convert Uint8Array back to hex string (shouldn't happen but handle it)
      hashString = '0x' + Buffer.from(hash).toString('hex');
    } else {
      console.error('[prepareCastBody] Invalid parentCastId hash format:', hash);
      throw new Error('Invalid parentCastId hash format - expected hex string or Uint8Array');
    }

    if (!hashString.startsWith('0x')) {
      console.error('[prepareCastBody] Hash missing 0x prefix:', hashString);
      throw new Error('Invalid parentCastId hash format - missing 0x prefix');
    }

    result.parentCastId = {
      fid: Number(castBody.parentCastId.fid),
      hash: hashString,
    };
    console.log('[prepareCastBody] parentCastId prepared:', {
      fid: result.parentCastId.fid,
      hash: result.parentCastId.hash.slice(0, 12) + '...',
    });
  }

  // Handle embed castIds - normalize to hex string for signer service
  if (result.embeds) {
    result.embeds = result.embeds.map((embed) => {
      if ('castId' in embed && embed.castId) {
        const castIdEmbed = embed as { castId: { fid: number; hash: string | Uint8Array } };
        const hash = castIdEmbed.castId.hash;
        let hashString: string;

        if (typeof hash === 'string') {
          hashString = hash;
        } else if (hash instanceof Uint8Array) {
          hashString = `0x${Buffer.from(hash).toString('hex')}`;
        } else {
          console.error('[prepareCastBody] Invalid embed castId hash type:', typeof hash);
          throw new Error('Invalid embed castId hash format');
        }

        if (!hashString.startsWith('0x')) {
          console.error('[prepareCastBody] Invalid embed castId hash format:', hashString);
          throw new Error('Invalid embed castId hash format - expected hex string with 0x prefix');
        }

        return {
          castId: {
            fid: Number(castIdEmbed.castId.fid),
            hash: hashString,
          },
        };
      }
      return embed;
    });
  }

  return result;
};

// todo: get this from supabase DB type
export type DraftObjectType = {
  id: string;
  data: object;
  created_at: string;
  scheduled_for?: string | null;
  published_at?: string | null;
  status: DraftStatus;
  account_id: string;
};

const tranformDBDraftForLocalStore = (draft: DraftObjectType): DraftType => {
  const {
    data,
  }: {
    data: {
      rawText?: string;
      parentUrl?: string;
      parentCastId?: {
        fid: number;
        hash: string; // Stored as hex string in DB
      };
      embeds?: Embed[];
    };
  } = draft;
  return {
    id: draft.id,
    text: data.rawText || '',
    parentUrl: data.parentUrl || undefined,
    parentCastId: data.parentCastId
      ? {
          fid: data.parentCastId.fid,
          hash: data.parentCastId.hash, // Already a hex string from DB
        }
      : undefined,
    embeds: data.embeds
      ? (data.embeds.map((embed) => ({
          url: embed.url,
        })) as FarcasterEmbed[])
      : undefined,
    // todo: embeds can also be an array of FarcasterEmbed
    // can also be cast_ids etc all of this stuff needs to work
    createdAt: new Date(draft.created_at).getTime(),
    scheduledFor: draft?.scheduled_for,
    publishedAt: draft?.published_at,
    status: draft.status,
    accountId: draft.account_id,
  };
};

const getMentionFids = getMentionFidsByUsernames();

type addNewPostDraftProps = {
  text?: string;
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  embeds?: FarcasterEmbed[];
  onSuccess?: (draftId: string, threadId: string) => void;
  force?: boolean;
};

interface NewPostStoreProps {
  drafts: DraftType[];
  isHydrated: boolean;
  isDraftsModalOpen: boolean;
  draftToFocus: string | null;
}

interface DraftStoreActions {
  getDraftById: (draftId: string) => DraftType | undefined;
  updateDraftById: (draftId: string, updates: Partial<DraftType>) => void;
  publishDraftById: (draftId: string, account: AccountObjectType, onPost?: () => void) => Promise<string | null>;
  scheduleDraftById: (draftId: string, scheduledFor: Date, onSuccess?: () => void) => Promise<void>;

  addNewPostDraft: ({ text, parentCastId, parentUrl, embeds, onSuccess, force }: addNewPostDraftProps) => void;
  removePostDraft: (draftIdx: number, onlyIfEmpty?: boolean) => void;
  removePostDraftById: (draftId: string) => Promise<void>;
  removeScheduledDraftFromDB: (draftId: string) => Promise<boolean>;
  removeAllPostDrafts: () => void;
  removeEmptyDrafts: () => void;
  hydrate: () => void;
  openDraftsModal: () => void;
  closeDraftsModal: () => void;

  createThread: () => string;
  addPostToThread: (threadId: string, afterIndex?: number) => string | null;
  removePostFromThread: (threadId: string, draftId: string) => void;
  reorderThreadPost: (threadId: string, fromIndex: number, toIndex: number) => void;
  getThreadDrafts: (threadId: string) => DraftType[];
  isThreadDraft: (draftId: string) => boolean;
  publishThread: (
    threadId: string,
    account: AccountObjectType,
    onProgress?: (index: number) => void
  ) => Promise<ThreadPublishResult>;
  publishSingleOrThread: (
    threadId: string,
    account: AccountObjectType,
    onProgress?: (index: number) => void
  ) => Promise<{ success: boolean; hash?: string; hashes?: string[]; error?: string }>;
  clearDraftToFocus: () => void;
}

export interface DraftStore extends NewPostStoreProps, DraftStoreActions {}

export const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DraftStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  drafts: [],
  isHydrated: false,
  isDraftsModalOpen: false,
  draftToFocus: null,
  clearDraftToFocus: () => {
    set((state) => {
      state.draftToFocus = null;
    });
  },
  addNewPostDraft: ({ text, parentUrl, parentCastId, embeds, onSuccess, force }: addNewPostDraftProps) => {
    const threadId = uuidv4();
    const draftId = uuidv4();

    set((state) => {
      const pendingDrafts = state.drafts.filter((draft) => draft.status === DraftStatus.writing);
      if (!force && !text && !parentUrl && !parentCastId && !embeds) {
        // check if there is an existing empty draft
        for (let i = 0; i < pendingDrafts.length; i++) {
          const draft = pendingDrafts[i];
          if (!draft.text && !draft.parentUrl && !draft.parentCastId && !draft.embeds) {
            onSuccess?.(draft.id, draft.threadId!);
            return;
          }
        }
      }
      if (!force && (parentUrl || parentCastId)) {
        // check if there is an existing draft for the same parent
        for (let i = 0; i < pendingDrafts.length; i++) {
          const draft = pendingDrafts[i];
          if (
            (parentUrl && parentUrl === draft.parentUrl) ||
            (parentCastId && parentCastId.hash === draft.parentCastId?.hash)
          ) {
            onSuccess?.(draft.id, draft.threadId!);
            return;
          }
        }
      }

      const createdAt = Date.now();
      const newDraft: DraftType = {
        ...NewPostDraft,
        text: text || '',
        id: draftId,
        parentUrl,
        parentCastId,
        embeds,
        createdAt,
        threadId,
        threadIndex: 0,
      };
      state.drafts = [...state.drafts, newDraft] as typeof state.drafts;
      onSuccess?.(draftId, threadId);
    });
  },
  getDraftById: (draftId: string) => {
    const state = useDraftStore.getState();
    return state.drafts.find((draft) => draft.id === draftId);
  },
  updateDraftById: (draftId: string, updates: Partial<DraftType>) => {
    set((state) => {
      const idx = state.drafts.findIndex((draft) => draft.id === draftId);
      if (idx !== -1) {
        state.drafts[idx] = { ...state.drafts[idx], ...updates };
      }
    });
  },
  publishDraftById: async (
    draftId: string,
    account: AccountObjectType,
    onPost?: () => void
  ): Promise<string | null> => {
    // Get current state snapshot outside set()
    const draft = useDraftStore.getState().drafts.find((d) => d.id === draftId);
    if (!draft) {
      console.error('Draft not found:', draftId);
      return null;
    }

    if (account.platform === AccountPlatformType.farcaster_local_readonly) {
      toastInfoReadOnlyMode();
      return null;
    }

    // Update status to publishing (sync)
    set((state) => {
      const idx = state.drafts.findIndex((d) => d.id === draftId);
      if (idx !== -1) {
        state.drafts[idx] = { ...state.drafts[idx], status: DraftStatus.publishing };
      }
    });

    try {
      // Do async work OUTSIDE set()
      const castBody = await prepareCastBody(draft);
      console.log('[publishDraftById] Cast body prepared:', {
        hasParentCastId: !!castBody.parentCastId,
        parentHash: castBody.parentCastId?.hash ? 'present' : 'none',
        embedCount: castBody.embeds?.length || 0,
      });
      const isPro = account?.user?.pro?.status === 'subscribed';
      const hash = await submitCast({
        ...castBody,
        accountId: account.id,
        isPro,
        idempotencyKey: draft.id,
      });

      // Update with result (sync)
      set((state) => {
        const idx = state.drafts.findIndex((d) => d.id === draftId);
        if (idx !== -1) {
          state.drafts[idx] = {
            ...state.drafts[idx],
            hash,
            status: DraftStatus.published,
            timestamp: new Date().toISOString(),
            accountId: account.id,
          };
        }
      });

      toastSuccessCastPublished(draft.text);
      onPost?.();
      return hash;
    } catch (error) {
      console.error('caught error in publishDraftById', error);
      // Handle error (sync)
      set((state) => {
        const idx = state.drafts.findIndex((d) => d.id === draftId);
        if (idx !== -1) {
          state.drafts[idx] = { ...state.drafts[idx], status: DraftStatus.writing };
        }
      });
      toastErrorCastPublish(error instanceof Error ? error.message : String(error));
      return null;
    }
  },
  scheduleDraftById: async (draftId: string, scheduledFor: Date, onSuccess?: () => void): Promise<void> => {
    // Get current state snapshot outside set()
    const draft = useDraftStore.getState().drafts.find((d) => d.id === draftId);
    if (!draft) {
      console.error('Draft not found:', draftId);
      return;
    }

    try {
      // Prepare cast body (async OUTSIDE set)
      let castBody;
      try {
        castBody = await prepareCastBody(draft);
        console.log('scheduleDraftById: castBody after prepareCastBody:', castBody);
      } catch (error) {
        console.error('Failed to prepare cast body:', error);
        return;
      }

      if (!castBody) {
        console.error('prepareCastBody returned null/undefined');
        return;
      }

      castBody = prepareCastBodyForDB(castBody);
      console.log('scheduleDraftById: castBody after prepareCastBodyForDB:', castBody);

      const accountState = useAccountStore.getState();
      const account = accountState.accounts[accountState.selectedAccountIdx];

      if (!account) {
        console.error('No account selected');
        return;
      }

      // Insert into DB (async OUTSIDE set)
      const { data, error } = await supabaseClient
        .from('draft')
        .insert({
          account_id: account.id,
          data: { ...castBody, rawText: draft.text },
          scheduled_for: scheduledFor.toISOString(),
          status: DraftStatus.scheduled,
        })
        .select();

      if (error || !data) {
        console.error('Failed to add scheduled draft', error, data);
        return;
      }

      // Update state with DB result (sync)
      const draftInDb = data[0] as unknown as DraftObjectType;
      set((state) => {
        const idx = state.drafts.findIndex((d) => d.id === draftId);
        if (idx !== -1) {
          state.drafts[idx] = tranformDBDraftForLocalStore(draftInDb);
        }
      });

      console.log('scheduleDraftById: Draft scheduled (server will encode at publish time)');
      toastSuccessCastScheduled(draft.text);

      onSuccess?.();
    } catch (error) {
      console.error('Error in scheduleDraftById:', error);
    }
  },
  removeEmptyDrafts: () => {
    set((state) => {
      state.drafts = state.drafts.filter((draft) => Boolean(draft.text.trim()));
    });
  },
  removePostDraft: (draftIdx: number, onlyIfEmpty?: boolean) => {
    set((state) => {
      if (draftIdx < 0 || draftIdx >= state.drafts.length) {
        return;
      }

      if (onlyIfEmpty && state.drafts[draftIdx]?.text) {
        return;
      }

      if (state.drafts.length === 1) {
        state.drafts = [];
      } else {
        const copy = [...state.drafts];
        copy.splice(draftIdx, 1);
        state.drafts = copy;
      }
    });
  },
  removePostDraftById: async (draftId: string) => {
    // Get current state snapshot outside set()
    const state = useDraftStore.getState();
    const draftIdx = state.drafts.findIndex((draft) => draft.id === draftId);
    const draft = state.drafts[draftIdx];
    if (!draft) {
      return;
    }

    // Handle scheduled drafts (async OUTSIDE set)
    if (draft.status === DraftStatus.scheduled) {
      const didRemove = await state.removeScheduledDraftFromDB(draftId);
      if (!didRemove) {
        return;
      }
      // removeScheduledDraftFromDB already updates the state, so we're done
      return;
    }

    // Remove non-scheduled draft (sync)
    state.removePostDraft(draftIdx);
  },
  removeAllPostDrafts: () => {
    set((state) => {
      state.drafts = [];
    });
  },
  removeScheduledDraftFromDB: async (draftId: string): Promise<boolean> => {
    const { data, error } = await supabaseClient
      .from('draft')
      .update({ status: DraftStatus.removed })
      .eq('id', draftId)
      .select();

    if (error || !data) {
      console.error('Failed to remove scheduled draft', error, data);
      return false;
    }

    set((state) => {
      const newDrafts = state.drafts.filter((draft) => draft.id !== draftId);
      state.drafts = newDrafts;
    });
    return true;
  },
  hydrate: async () => {
    supabaseClient
      .from('draft')
      .select('*')
      .neq('status', DraftStatus.removed)
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Failed to hydrate drafts', error, data);
          return;
        }
        const state = useDraftStore.getState();
        const dbDrafts = (data as unknown as DraftObjectType[]).map(tranformDBDraftForLocalStore);
        const allDrafts = uniqBy([...dbDrafts, ...state.drafts], 'id');

        // Migrate any draft without threadId
        const migratedDrafts = allDrafts.map((draft) => {
          if (!draft.threadId) {
            return {
              ...draft,
              threadId: uuidv4(),
              threadIndex: 0,
            };
          }
          return draft;
        });

        state.drafts = migratedDrafts;
        state.isHydrated = true;
      });
  },
  openDraftsModal: () => {
    set((state) => {
      state.isDraftsModalOpen = true;
    });
  },
  closeDraftsModal: () => {
    set((state) => {
      state.isDraftsModalOpen = false;
    });
  },
  createThread: () => {
    const threadId = uuidv4();
    const draftId = uuidv4();
    set((state) => {
      const newDraft: DraftType = {
        ...NewPostDraft,
        id: draftId,
        text: '',
        createdAt: Date.now(),
        threadId: threadId,
        threadIndex: 0,
      };
      state.drafts = [...state.drafts, newDraft] as typeof state.drafts;
    });
    return threadId;
  },
  addPostToThread: (threadId: string, afterIndex?: number) => {
    const state = useDraftStore.getState();
    const threadDrafts = state.drafts
      .filter((draft) => draft.threadId === threadId)
      .sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));

    if (threadDrafts.length >= MAX_THREAD_POSTS) {
      return null;
    }

    const newDraftId = uuidv4();
    let newThreadIndex: number;

    if (afterIndex !== undefined) {
      // Insert after the specified index
      newThreadIndex = afterIndex + 1;

      set((state) => {
        // Create the new draft
        const newDraft: DraftType = {
          ...NewPostDraft,
          id: newDraftId,
          text: '',
          createdAt: Date.now(),
          threadId: threadId,
          threadIndex: newThreadIndex,
        };

        // Update indices of subsequent drafts
        state.drafts = state.drafts.map((draft) => {
          if (draft.threadId === threadId && draft.threadIndex !== undefined && draft.threadIndex > afterIndex) {
            return { ...draft, threadIndex: draft.threadIndex + 1 };
          }
          return draft;
        });

        // Add new draft
        state.drafts = [...state.drafts, newDraft] as typeof state.drafts;
        // Set focus to new draft
        state.draftToFocus = newDraftId;
      });
    } else {
      // Append to the end
      newThreadIndex = threadDrafts.length > 0 ? Math.max(...threadDrafts.map((d) => d.threadIndex ?? 0)) + 1 : 1;

      set((state) => {
        const newDraft: DraftType = {
          ...NewPostDraft,
          id: newDraftId,
          text: '',
          createdAt: Date.now(),
          threadId: threadId,
          threadIndex: newThreadIndex,
        };
        state.drafts = [...state.drafts, newDraft] as typeof state.drafts;
        // Set focus to new draft
        state.draftToFocus = newDraftId;
      });
    }

    return newDraftId;
  },
  removePostFromThread: (threadId: string, draftId: string) => {
    set((state) => {
      // Remove the draft
      state.drafts = state.drafts.filter((draft) => draft.id !== draftId);

      // Get remaining thread drafts and reindex
      const remainingDrafts = state.drafts
        .filter((draft) => draft.threadId === threadId)
        .sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));

      // Reassign indices
      state.drafts = state.drafts.map((draft) => {
        if (draft.threadId === threadId) {
          const newIndex = remainingDrafts.findIndex((d) => d.id === draft.id);
          return { ...draft, threadIndex: newIndex };
        }
        return draft;
      });
    });
  },
  reorderThreadPost: (threadId: string, fromIndex: number, toIndex: number) => {
    set((state) => {
      const threadDrafts = state.drafts
        .filter((draft) => draft.threadId === threadId)
        .sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));

      if (fromIndex < 0 || fromIndex >= threadDrafts.length || toIndex < 0 || toIndex >= threadDrafts.length) {
        return;
      }

      // Perform array reordering
      const [movedDraft] = threadDrafts.splice(fromIndex, 1);
      threadDrafts.splice(toIndex, 0, movedDraft);

      // Update threadIndex for all drafts in the thread
      state.drafts = state.drafts.map((draft) => {
        if (draft.threadId === threadId) {
          const newIndex = threadDrafts.findIndex((d) => d.id === draft.id);
          return { ...draft, threadIndex: newIndex };
        }
        return draft;
      });
    });
  },
  getThreadDrafts: (threadId: string) => {
    const state = useDraftStore.getState();
    return state.drafts
      .filter((draft) => draft.threadId === threadId)
      .sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));
  },
  isThreadDraft: (draftId: string) => {
    const draft = useDraftStore.getState().getDraftById(draftId);
    return !!draft?.threadId;
  },
  publishThread: async (
    threadId: string,
    account: AccountObjectType,
    onProgress?: (index: number) => void
  ): Promise<ThreadPublishResult> => {
    const { getThreadDrafts, publishDraftById, updateDraftById } = useDraftStore.getState();
    const posts = getThreadDrafts(threadId);

    if (posts.length === 0) {
      return { success: false, publishedPosts: [], threadId, error: 'No posts in thread' };
    }

    const result: ThreadPublishResult = {
      success: true,
      publishedPosts: [],
      threadId,
    };

    // 1. Publish first post
    const firstDraft = posts[0];
    let firstHash: string;

    onProgress?.(0);

    try {
      const hash = await publishDraftById(firstDraft.id, account);
      if (!hash) throw new Error('Failed to publish first post');
      firstHash = hash;
      result.publishedPosts.push({ draftId: firstDraft.id, hash: firstHash, index: 0 });
    } catch (error) {
      result.success = false;
      result.failedAt = 0;
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }

    // 2. Publish remaining posts as replies to first post
    for (let i = 1; i < posts.length; i++) {
      const post = posts[i];

      // Small delay between posts for reliability and visual feedback
      await new Promise((resolve) => setTimeout(resolve, 500));

      onProgress?.(i);

      // Set parentCastId to first post
      updateDraftById(post.id, {
        parentCastId: {
          fid: Number(account.platformAccountId),
          hash: firstHash,
        },
      });

      try {
        const hash = await publishDraftById(post.id, account);
        if (!hash) throw new Error(`Failed to publish post ${i + 1}`);
        result.publishedPosts.push({ draftId: post.id, hash, index: i });
      } catch (error) {
        result.success = false;
        result.failedAt = i;
        result.error = error instanceof Error ? error.message : String(error);
        break; // Stop on first failure
      }
    }

    return result;
  },
  publishSingleOrThread: async (
    threadId: string,
    account: AccountObjectType,
    onProgress?: (index: number) => void
  ): Promise<{ success: boolean; hash?: string; hashes?: string[]; error?: string }> => {
    const { getThreadDrafts, publishDraftById, publishThread } = useDraftStore.getState();
    const posts = getThreadDrafts(threadId);

    if (posts.length === 0) {
      return { success: false, error: 'No posts in thread' };
    }

    if (posts.length === 1) {
      // Single post - use regular publish
      const hash = await publishDraftById(posts[0].id, account);
      return hash ? { success: true, hash } : { success: false, error: 'Failed to publish' };
    }

    // Multiple posts - use thread publish
    const result = await publishThread(threadId, account, onProgress);
    return {
      success: result.success,
      hash: result.publishedPosts[0]?.hash,
      hashes: result.publishedPosts.map((p) => p.hash),
      error: result.error,
    };
  },
});
export const useDraftStore = create<DraftStore>()(
  persist(mutative(store), {
    name: 'herocast-post-store',
    storage: createJSONStorage(() => sessionStorage),
    partialize: (state) => ({
      drafts: state.drafts,
      isHydrated: state.isHydrated,
    }),
  })
);

export const newPostCommands: CommandType[] = [
  {
    name: 'New Post',
    aliases: ['cast', 'write', 'create', 'compose', 'draft'],
    icon: PlusCircleIcon,
    shortcut: 'c',
    action: () => {
      useDraftStore.getState().addNewPostDraft({
        onSuccess(draftId) {
          const { setCastModalView, openNewCastModal, setCastModalDraftId } = useNavigationStore.getState();

          setCastModalView(CastModalView.New);
          setCastModalDraftId(draftId);
          openNewCastModal();
        },
      });
    },
    options: {
      enableOnFormTags: false,
      preventDefault: true,
    },
  },
  {
    name: 'Remove all drafts',
    aliases: ['cleanup'],
    icon: TrashIcon,
    action: () => useDraftStore.getState().removeAllPostDrafts(),
    navigateTo: '/post',
  },
];
