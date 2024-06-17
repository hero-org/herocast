/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { create as mutativeCreate, Draft } from "mutative";
import { CommandType } from "@/common/constants/commands";
import {
  PlusCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { AccountObjectType, useAccountStore } from "./useAccountStore";
import {
  DraftStatus,
  DraftType,
  ParentCastIdType,
} from "@/common/constants/farcaster";
import {
  getMentionFidsByUsernames,
  formatPlaintextToHubCastMessage,
} from "@mod-protocol/farcaster";
import { submitCast } from "@/common/helpers/farcaster";
import { toBytes, toHex } from "viem";
import { CastAddBody, CastId, Embed } from "@farcaster/hub-web";
import { AccountPlatformType } from "@/common/constants/accounts";
import {
  toastErrorCastPublish,
  toastInfoReadOnlyMode,
  toastSuccessCastPublished,
  toastSuccessCastScheduled,
} from "@/common/helpers/toast";
import { NewPostDraft } from "@/common/constants/postDrafts";
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
import { createClient } from "@/common/helpers/supabase/component";
import { UUID } from "crypto";
import { v4 as uuidv4 } from 'uuid';
import uniqBy from "lodash.uniqby";

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
    throw new Error("Failed to prepare cast");
  }
  if (castBody.parentCastId) {
    castBody.parentCastId = {
      fid: Number(castBody.parentCastId.fid),
      hash: toHex(castBody.parentCastId.hash),
    };
  }
  if (castBody.embeds) {
    castBody.embeds.forEach(embed => {
      if ('castId' in embed) {
        embed.castId = { fid: Number(embed?.castId?.fid), hash: toBytes(embed?.castId?.hash) };
      }
    });
  }

  return castBody;
}

// todo: get this from supabase DB type
export type DraftObjectType = {
  id: UUID;
  data: object;
  createdAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  status: DraftStatus
  account_id: UUID;
}

const tranformDBDraftForLocalStore = (draft: DraftObjectType): DraftType => {
  const { data }: { data: {
    rawText?: string;
    parentUrl?: string;
    parentCastId?: {
      fid: number;
      hash: Uint8Array;
    };
    embeds?: Embed[];
  }} = draft;
  return {
    id: draft.id,
    text: data.rawText || "",
    parentUrl: data.parentUrl || undefined,
    parentCastId: data.parentCastId ? {
      fid: data.parentCastId.fid,
      hash: new Uint8Array(data.parentCastId.hash)
    } : undefined,
    embeds: data.embeds ? data.embeds.map((embed) => ({
      url: embed.url,
    })) : undefined,
    // todo: embeds can also be an array of FarcasterEmbed
    // can also be cast_ids etc all of this stuff needs to work
    createdAt: draft.created_at,
    scheduledFor: draft?.scheduled_for,
    publishedAt: draft?.published_at,
    status: draft.status,
    accountId: draft.account_id,
  };
}



const getMentionFids = getMentionFidsByUsernames(
  process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!,
);

type addNewPostDraftProps = {
  text?: string;
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  embeds?: FarcasterEmbed[];
};

type addScheduledDraftProps = {
  castBody: object;
  scheduledFor: Date;
  rawText: string;
};

interface NewPostStoreProps {
  drafts: DraftType[];
}

interface DraftStoreActions {
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewPostDraft: ({ text, parentCastId, parentUrl, embeds }: addNewPostDraftProps) => void;
  addScheduledDraft: ({ castBody, scheduledFor }: addScheduledDraftProps) => void;
  removePostDraft: (draftIdx: number, onlyIfEmpty?: boolean) => void;
  removePostDraftById: (draftId: UUID) => void;
  removeScheduledDraft: (draftId: UUID) => Promise<boolean>;
  removeAllPostDrafts: () => void;
  publishPostDraft: (
    draftIdx: number,
    account: AccountObjectType,
    onPost?: () => void,
  ) => Promise<string | null>;
}

export interface DraftStore extends NewPostStoreProps, DraftStoreActions { }

export const mutative = (config) => (set, get) =>
  config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<DraftStore>) => void) => void;

const store = (set: StoreSet) => ({
  drafts: [],
  addNewPostDraft: ({ text, parentUrl, parentCastId, embeds }: addNewPostDraftProps) => {
    set((state) => {
      if (!text && !parentUrl && !parentCastId && !embeds) {
        // check if there is an existing empty draft
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if (!draft.text && !draft.parentUrl && !draft.parentCastId && !draft.embeds) {
            console.log('found an empty draft')
            return;
          }
        }
      }

      if (parentUrl || parentCastId) {
        // check if there is an existing draft for the same parent
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if (
            (parentUrl && parentUrl === draft.parentUrl) ||
            (parentCastId &&
              parentCastId.hash === draft.parentCastId?.hash)
          ) {
            return;
          }
        }
      }

      const createdAt = Date.now();
      const id = uuidv4();
      const newDraft = { ...NewPostDraft, text: text || '', id, parentUrl, parentCastId, embeds, createdAt };
      state.drafts = [...state.drafts, newDraft];
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
  updateMentionsToFids: (
    draftIdx: number,
    mentionsToFids: { [key: string]: string },
  ) => {
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
  removePostDraft: (draftIdx: number, onlyIfEmpty?: boolean) => {
    console.log('removePostDraft', draftIdx)
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
      if (draft.status === DraftStatus.scheduled) {
        const didRemove = await state.removeScheduledDraft(draftId);
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
  publishPostDraft: async (
    draftIdx: number,
    account: AccountObjectType,
    onPost?: () => null,
  ): Promise<void> => {
    set(async (state) => {
      if (account.platform === AccountPlatformType.farcaster_local_readonly) {
        toastInfoReadOnlyMode();
        return;
      }

      const draft = state.drafts[draftIdx];

      try {
        await state.updatePostDraft(draftIdx, { ...draft, status: DraftStatus.publishing });
        const castBody = await prepareCastBody(draft);

        await submitCast({
          ...castBody,
          signerPrivateKey: account.privateKey!,
          fid: Number(account.platformAccountId),
        });

        state.removePostDraft(draftIdx);
        toastSuccessCastPublished(draft.text);

        if (onPost) onPost();
      } catch (error) {
        console.error('caught error in newPostStore', error);
        toastErrorCastPublish(error instanceof Error ? error.message : String(error));
      }
    });
  },
  addScheduledDraft: async ({ castBody, scheduledFor, rawText }) => {
    const supabaseClient = createClient();

    console.log('addScheduledDraft start', castBody, scheduledFor)
    const accountState = useAccountStore.getState();
    const account = accountState.accounts[accountState.selectedAccountIdx];
    const { data, error } = await supabaseClient
      .from('draft')
      .insert({
        account_id: account.id,
        data: { ...castBody, rawText },
        scheduled_for: scheduledFor,
        status: DraftStatus.scheduled,
      })
      .select()
    if (error || !data) {
      console.error('Failed to add scheduled draft', error, data);
      return;
    }

    toastSuccessCastScheduled(rawText);

    set((state) => {
      state.drafts = [...state.drafts, tranformDBDraftForLocalStore(data[0])];
      console.log('addScheduledDraft end, now has drafts:', state.drafts.length)
    });
  },
  removeScheduledDraft: async (draftId: UUID): Promise<boolean> => {
    const supabaseClient = createClient();
    const { data, error } = await supabaseClient
      .from('draft')
      .update({ status: DraftStatus.removed })
      .eq('id', draftId)
      .select()

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
});
export const useDraftStore = create<DraftStore>()(
  persist(mutative(store), {
    name: "herocast-post-store",
    storage: createJSONStorage(() => sessionStorage),
  }),
);

export const newPostCommands: CommandType[] = [
  {
    name: "New Post",
    aliases: ["cast", "write", "create", "compose", "draft"],
    icon: PlusCircleIcon,
    shortcut: 'c',
    navigateTo: "/post",
    action: () => {
      // need to upgrade NewCastModal to receive a draftIdx instead of a linkedCast
      // const { setCastModalView, openNewCastModal } = useNavigationStore.getState();
      // setCastModalView(CastModalView.New);
      // openNewCastModal();
    },
    options: {
      enableOnFormTags: false,
      preventDefault: true,
    },
  },
  {
    name: "Remove all drafts",
    aliases: ["cleanup"],
    icon: TrashIcon,
    action: () => useDraftStore.getState().removeAllPostDrafts(),
    navigateTo: "/post",
  },
];

const supabaseClient = createClient();
const hydrateDrafts = async () => {
  console.log('hydrateDrafts 📝')

  supabaseClient.
    from('draft')
    .select('*')
    .then(({ data, error }) => {
      console.log('hydrateDrafts data:', data, 'error:', error)
      if (error || !data) {
        console.error('Failed to hydrate drafts', error, data);
        return;
      }
      const state = useDraftStore.getState();
      const dbDrafts = data.map(tranformDBDraftForLocalStore);
      state.drafts = uniqBy([...state.drafts, ...dbDrafts], 'id'); 
    });

  console.log('hydrateDrafts done 📝')
}

// client-side-only
if (typeof window !== 'undefined') {
  hydrateDrafts();
}