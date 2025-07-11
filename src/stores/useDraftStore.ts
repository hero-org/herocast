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
import { toBytes, toHex } from 'viem';
import { CastAddBody, CastId, Embed, makeCastAdd, Message, NobleEd25519Signer } from '@farcaster/hub-web';
import { AccountPlatformType } from '@/common/constants/accounts';
import {
  toastErrorCastPublish,
  toastInfoReadOnlyMode,
  toastSuccessCastPublished,
  toastSuccessCastScheduled,
} from '@/common/helpers/toast';
import { NewPostDraft } from '@/common/constants/postDrafts';
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
import { createClient } from '@/common/helpers/supabase/component';
import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import uniqBy from 'lodash.uniqby';
import { CastModalView, useNavigationStore } from './useNavigationStore';

const prepareCastBodyForDB = (castBody) => {
  if (castBody.embeds) {
    castBody.embeds.forEach((embed) => {
      if ('castId' in embed) {
        embed.castId = {
          fid: embed.castId.fid,
          hash: embed?.castId?.hash.toString(),
        };
      }
    });
  }
  return castBody;
};

export const prepareCastBody = async (draft: any): Promise<CastAddBody> => {
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
  if (castBody.parentCastId) {
    castBody.parentCastId = {
      fid: Number(castBody.parentCastId.fid),
      hash: toHex(castBody.parentCastId.hash),
    };
  }
  if (castBody.embeds) {
    castBody.embeds.forEach((embed) => {
      if ('castId' in embed) {
        embed.castId = {
          fid: Number(embed?.castId?.fid),
          hash: toBytes(embed?.castId?.hash),
        };
      }
    });
  }

  return castBody;
};

// todo: get this from supabase DB type
export type DraftObjectType = {
  id: UUID;
  data: object;
  createdAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  status: DraftStatus;
  account_id: UUID;
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
        hash: Uint8Array;
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
          hash: data.parentCastId.hash,
        }
      : undefined,
    embeds: data.embeds
      ? data.embeds.map((embed) => ({
          url: embed.url,
        }))
      : undefined,
    // todo: embeds can also be an array of FarcasterEmbed
    // can also be cast_ids etc all of this stuff needs to work
    createdAt: draft.created_at,
    scheduledFor: draft?.scheduled_for,
    publishedAt: draft?.published_at,
    status: draft.status,
    accountId: draft.account_id,
  };
};

const getMentionFids = getMentionFidsByUsernames();

// Pre-encode cast message using the working client-side packages
const preEncodeCastMessage = async (castBody: CastAddBody, account: AccountObjectType): Promise<number[]> => {
  try {
    console.log('preEncodeCastMessage: Starting with castBody:', JSON.stringify(castBody, null, 2));
    console.log('preEncodeCastMessage: Account platformAccountId:', account.platformAccountId);
    console.log('preEncodeCastMessage: Account has privateKey:', !!account.privateKey);

    if (!castBody) {
      throw new Error('castBody is null or undefined');
    }

    if (!castBody.text && !castBody.embeds?.length) {
      throw new Error('castBody has no text or embeds');
    }

    if (!account || !account.platformAccountId || !account.privateKey) {
      throw new Error(
        `Invalid account data: platformAccountId=${account.platformAccountId}, hasPrivateKey=${!!account.privateKey}`
      );
    }

    const dataOptions = {
      fid: Number(account.platformAccountId),
      network: 1, // Farcaster mainnet
    };
    console.log('preEncodeCastMessage: dataOptions:', dataOptions);

    // Clean private key
    let cleanPrivateKey = account.privateKey;
    if (cleanPrivateKey.startsWith('0x')) {
      cleanPrivateKey = cleanPrivateKey.slice(2);
    }

    console.log('preEncodeCastMessage: privateKey length:', cleanPrivateKey.length);
    console.log('preEncodeCastMessage: privateKey format valid:', /^[0-9a-fA-F]{64}$/.test(cleanPrivateKey));

    const privateKeyBytes = toBytes(`0x${cleanPrivateKey}`);
    console.log('preEncodeCastMessage: privateKeyBytes length:', privateKeyBytes.length);

    const signer = new NobleEd25519Signer(privateKeyBytes);
    console.log('preEncodeCastMessage: signer created successfully');

    console.log('preEncodeCastMessage: calling makeCastAdd...');
    const msg = await makeCastAdd(castBody, dataOptions, signer);
    if (msg.isErr()) {
      console.error('preEncodeCastMessage: makeCastAdd failed:', msg.error);
      throw msg.error;
    }

    console.log('preEncodeCastMessage: makeCastAdd succeeded, encoding message...');
    const messageBytes = Buffer.from(Message.encode(msg.value).finish());
    console.log('preEncodeCastMessage: encoded message bytes length:', messageBytes.length);

    const result = Array.from(messageBytes);
    console.log('preEncodeCastMessage: converted to array, final length:', result.length);
    return result; // Convert to array for JSON storage
  } catch (error) {
    console.error('preEncodeCastMessage: Failed to pre-encode cast message:', error);
    console.error('preEncodeCastMessage: Error stack:', error.stack);
    throw error;
  }
};

type addNewPostDraftProps = {
  text?: string;
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  embeds?: FarcasterEmbed[];
  onSuccess?: (draftId) => void;
  force?: boolean;
};

type addScheduledDraftProps = {
  draftIdx: number;
  scheduledFor: Date;
  onSuccess?: () => void;
};

interface NewPostStoreProps {
  drafts: DraftType[];
  isHydrated: boolean;
  isDraftsModalOpen: boolean;
}

interface DraftStoreActions {
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewPostDraft: ({ text, parentCastId, parentUrl, embeds, onSuccess, force }: addNewPostDraftProps) => void;
  addScheduledDraft: ({ draftIdx, scheduledFor, onSuccess }: addScheduledDraftProps) => void;
  removePostDraft: (draftIdx: number, onlyIfEmpty?: boolean) => void;
  removePostDraftById: (draftId: UUID) => void;
  removeScheduledDraftFromDB: (draftId: UUID) => Promise<boolean>;
  removeAllPostDrafts: () => void;
  removeEmptyDrafts: () => void;
  publishPostDraft: (draftIdx: number, account: AccountObjectType, onPost?: () => void) => Promise<string | null>;
  hydrate: () => void;
  openDraftsModal: () => void;
  closeDraftsModal: () => void;
}

export interface DraftStore extends NewPostStoreProps, DraftStoreActions {}

export const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DraftStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  drafts: [],
  isHydrated: false,
  isDraftsModalOpen: false,
  addNewPostDraft: ({ text, parentUrl, parentCastId, embeds, onSuccess, force }: addNewPostDraftProps) => {
    set((state) => {
      const pendingDrafts = state.drafts.filter((draft) => draft.status === DraftStatus.writing);
      if (!force && !text && !parentUrl && !parentCastId && !embeds) {
        // check if there is an existing empty draft
        for (let i = 0; i < pendingDrafts.length; i++) {
          const draft = pendingDrafts[i];
          if (!draft.text && !draft.parentUrl && !draft.parentCastId && !draft.embeds) {
            onSuccess?.(draft.id);
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
            onSuccess?.(draft.id);
            return;
          }
        }
      }

      const createdAt = Date.now();
      const id = uuidv4();
      const newDraft = {
        ...NewPostDraft,
        text: text || '',
        id,
        parentUrl,
        parentCastId,
        embeds,
        createdAt,
      };
      state.drafts = [...state.drafts, newDraft];
      onSuccess?.(id);
    });
  },
  updatePostDraft: (draftIdx: number, draft: DraftType) => {
    set((state) => {
      state.drafts = [
        ...(draftIdx > 0 ? state.drafts.slice(0, draftIdx) : []),
        draft,
        ...state.drafts.slice(draftIdx + 1),
      ];
    });
  },
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => {
    set((state) => {
      const draft = state.drafts[draftIdx];
      state.drafts = [
        ...(draftIdx > 0 ? state.drafts.slice(0, draftIdx) : []),
        { ...draft, mentionsToFids },
        ...state.drafts.slice(draftIdx + 1),
      ];

      const copy = [...state.drafts];
      copy.splice(draftIdx, 1, { ...draft, mentionsToFids });
      state.drafts = copy;
    });
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
  removePostDraftById: (draftId: UUID) => {
    set(async (state) => {
      const draftIdx = state.drafts.findIndex((draft) => draft.id === draftId);
      const draft = state.drafts[draftIdx];
      if (!draft) {
        return;
      }

      if (draft.status === DraftStatus.scheduled) {
        const didRemove = await state.removeScheduledDraftFromDB(draftId);
        if (!didRemove) {
          return;
        }
      }
      state.removePostDraft(draftIdx);
    });
  },
  removeAllPostDrafts: () => {
    set((state) => {
      state.drafts = [];
    });
  },
  publishPostDraft: async (draftIdx: number, account: AccountObjectType, onPost?: () => null): Promise<void> => {
    set(async (state) => {
      if (account.platform === AccountPlatformType.farcaster_local_readonly) {
        toastInfoReadOnlyMode();
        return;
      }
      const draft = state.drafts[draftIdx];

      try {
        await state.updatePostDraft(draftIdx, {
          ...draft,
          status: DraftStatus.publishing,
        });
        const castBody = await prepareCastBody(draft);
        console.log('castBody', castBody);
        console.log('account', account);
        const hash = await submitCast({
          ...castBody,
          signerPrivateKey: account.privateKey!,
          fid: Number(account.platformAccountId),
        });

        await state.updatePostDraft(draftIdx, {
          ...draft,
          hash,
          status: DraftStatus.published,
          timestamp: new Date().toISOString(),
          accountId: account.id,
        });
        toastSuccessCastPublished(draft.text);

        if (onPost) onPost();
      } catch (error) {
        console.error('caught error in useDraftStore', error);
        toastErrorCastPublish(error instanceof Error ? error.message : String(error));
      }
    });
  },
  addScheduledDraft: async ({ draftIdx, scheduledFor, onSuccess }) => {
    set(async (state) => {
      try {
        const draft = state.drafts[draftIdx];
        console.log('addScheduledDraft: draft:', draft);

        if (!draft) {
          console.error('Draft not found at index:', draftIdx);
          return;
        }

        let castBody;
        try {
          castBody = await prepareCastBody(draft);
          console.log('addScheduledDraft: castBody after prepareCastBody:', castBody);
        } catch (error) {
          console.error('Failed to prepare cast body:', error);
          return;
        }

        if (!castBody) {
          console.error('prepareCastBody returned null/undefined');
          return;
        }

        castBody = prepareCastBodyForDB(castBody);
        console.log('addScheduledDraft: castBody after prepareCastBodyForDB:', castBody);

        const accountState = useAccountStore.getState();
        const account = accountState.accounts[accountState.selectedAccountIdx];

        if (!account) {
          console.error('No account selected');
          return;
        }

        let encodedMessageBytes = null;

        try {
          // Pre-encode the message using the working client-side packages
          console.log('addScheduledDraft: Starting pre-encoding...');
          console.log('addScheduledDraft: castBody for pre-encoding:', JSON.stringify(castBody, null, 2));
          console.log('addScheduledDraft: account for pre-encoding:', {
            id: account.id,
            platformAccountId: account.platformAccountId,
            hasPrivateKey: !!account.privateKey,
          });

          encodedMessageBytes = await preEncodeCastMessage(castBody, account);
          console.log('addScheduledDraft: Successfully pre-encoded message, bytes length:', encodedMessageBytes.length);
          console.log('addScheduledDraft: First 10 bytes:', encodedMessageBytes.slice(0, 10));
        } catch (error) {
          console.warn('addScheduledDraft: Failed to pre-encode message, will fallback to runtime encoding:', error);
          console.warn('addScheduledDraft: Error details:', error.message);
          console.warn('addScheduledDraft: Error stack:', error.stack);
          // Continue without pre-encoded bytes - the Supabase function will handle it
        }

        await supabaseClient
          .from('draft')
          .insert({
            account_id: account.id,
            data: { ...castBody, rawText: draft.text },
            // Only include encoded_message_bytes if we have them
            ...(encodedMessageBytes ? { encoded_message_bytes: encodedMessageBytes } : {}),
            scheduled_for: scheduledFor,
            status: DraftStatus.scheduled,
          })
          .select()
          .then(({ data, error }) => {
            if (error || !data) {
              console.error('Failed to add scheduled draft', error, data);
              return;
            }

            const draftInDb = data[0];
            state.updatePostDraft(draftIdx, tranformDBDraftForLocalStore(draftInDb));

            if (encodedMessageBytes) {
              console.log('addScheduledDraft: Draft scheduled with pre-encoded bytes');
              toastSuccessCastScheduled(`${draft.text} (pre-encoded for reliable publishing)`);
            } else {
              console.log('addScheduledDraft: Draft scheduled without pre-encoded bytes');
              toastSuccessCastScheduled(`${draft.text} (will encode at publish time)`);
            }

            onSuccess?.();
          });
      } catch (error) {
        console.error('Error in addScheduledDraft:', error);
      }
    });
  },
  removeScheduledDraftFromDB: async (draftId: UUID): Promise<boolean> => {
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
        const dbDrafts = data.map(tranformDBDraftForLocalStore);
        state.drafts = uniqBy([...dbDrafts, ...state.drafts], 'id');
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
