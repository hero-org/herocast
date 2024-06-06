/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from "../../src/common/constants/commands";
import { PlusCircleIcon, TagIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AccountObjectType } from "./useAccountStore";
import { DraftStatus, DraftType, ParentCastIdType } from "../../src/common/constants/farcaster";
import {
  getMentionFidsByUsernames,
  formatPlaintextToHubCastMessage,
} from '@mod-protocol/farcaster';
import { submitCast } from "@/common/helpers/farcaster";
import { toBytes, toHex } from "viem";
import { CastId } from "@farcaster/hub-web";
import { AccountPlatformType } from "@/common/constants/accounts";
import { toastErrorCastPublish, toastInfoReadOnlyMode, toastSuccessCastPublished } from "@/common/helpers/toast";
import { Embed } from "@standard-crypto/farcaster-js-hub-rest";
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
import { CastModalView, useNavigationStore } from "./useNavigationStore";

const getMentionFids = getMentionFidsByUsernames(process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!);

export const NewPostDraft: DraftType = {
  text: "",
  parentUrl: undefined,
  parentCastId: undefined,
  status: DraftStatus.writing,
  mentionsToFids: {},
};


const NewFeedbackPostDraft: DraftType = {
  text: "hey @hellno, feedback on @herocast: ",
  parentUrl: "https://herocast.xyz",
  status: DraftStatus.writing,
  mentionsToFids: { 'herocast': '18665', 'hellno': '13596' }
};

export const JoinedHerocastPostDraft: DraftType = {
  text: "I just joined @herocast! ",
  status: DraftStatus.writing,
  mentionsToFids: { 'herocast': '18665' }
}

export const JoinedHerocastViaHatsProtocolDraft: DraftType = {
  text: "I just joined @herocast via @hatsprotocol",
  status: DraftStatus.writing,
  mentionsToFids: { 'herocast': '18665', 'hatsprotocol': '18484' }
}

export const LaunchCasterScoutDraft: DraftType = {
  text: `@launch `,
  status: DraftStatus.writing,
  mentionsToFids: { 'launch': '2864', 'herocast': '18665' }
}

export const BountyCasterBotDraft: DraftType = {
  text: `Description (be specific on details and any criteria for completing e.g. favorite answer wins, apply to work on this, X number of claims available) 
  Amount (USDC, ETH, OP, Warps, degen, higher, or SOL)
  Deadline (optional, defaults to 2 weeks)
  @bountybot posted via @herocast`,
  status: DraftStatus.writing,
  mentionsToFids: { 'bountybot': '20596', 'herocast': '18665' }
}

export const RemindMeBotDraft: DraftType = {
  text: "@remindme 1 day",
  status: DraftStatus.writing,
  mentionsToFids: { 'remindme': '2684' }
}

type addNewPostDraftProps = {
  text?: string
  parentUrl?: string
  parentCastId?: ParentCastIdType,
  embeds?: FarcasterEmbed[]
};


interface NewPostStoreProps {
  drafts: DraftType[];
}

interface NewPostStoreActions {
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewPostDraft: ({ text, parentCastId, parentUrl, embeds }: addNewPostDraftProps) => void;
  addFeedbackDraft: () => void;
  removePostDraft: (draftId: number, onlyIfEmpty?: boolean) => void;
  removeAllPostDrafts: () => void;
  publishPostDraft: (draftIdx: number, account: AccountObjectType, onPost?: () => void) => Promise<string | null>;
}

export interface NewPostStore extends NewPostStoreProps, NewPostStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NewPostStore>) => void) => void;

const store = (set: StoreSet) => ({
  drafts: [],
  addNewPostDraft: ({ text, parentUrl, parentCastId, embeds }: addNewPostDraftProps) => {
    set((state) => {
      if (!text && !parentUrl && !parentCastId && !embeds) {
        // check if there is an existing empty draft
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if (!draft.text) {
            return
          }
        }
      }
      if (parentUrl || parentCastId) {
        // check if there is an existing draft for the same parent
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if ((parentUrl && parentUrl === draft.parentUrl) ||
            (parentCastId && parentCastId.hash === draft.parentCastId?.hash)) {
            return;
          }
        }
      }

      const newDraft = { ...NewPostDraft, text: text || '', parentUrl, parentCastId, embeds };
      state.drafts = [...state.drafts, newDraft];
    });
  },
  addFeedbackDraft: () => {
    set((state) => {
      state.drafts.push(NewFeedbackPostDraft);
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
        await state.updatePostDraft(draftIdx, { ...draft, status: DraftStatus.publishing });
        const castBody: {
          text: string;
          embeds?: Embed[] | undefined;
          embedsDeprecated?: string[];
          mentions?: number[];
          mentionsPositions?: number[];
          parentCastId?: CastId | { fid: number, hash: string };
        } | false = await formatPlaintextToHubCastMessage({
          text: draft.text,
          embeds: draft.embeds || [],
          getMentionFidsByUsernames: getMentionFids,
          parentUrl: draft.parentUrl,
          parentCastFid: draft.parentCastId ? Number(draft.parentCastId.fid) : undefined,
          parentCastHash: draft.parentCastId ? toHex(draft.parentCastId.hash) : undefined,
        });

        if (!castBody) {
          throw new Error('Failed to prepare cast');
        }
        if (castBody.parentCastId) {
          castBody.parentCastId = {
            fid: Number(castBody.parentCastId.fid),
            hash: toHex(castBody.parentCastId.hash)
          }
        }
        if (castBody.embeds) {
          castBody.embeds.forEach(embed => {
            if ('castId' in embed) {
              embed.castId = { fid: Number(embed.castId.fid), hash: toBytes(embed.castId.hash) };
            }
          });
        }
        
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
});
export const useNewPostStore = create<NewPostStore>()(persist(mutative(store),
  {
    'name': 'herocast-post-store',
    storage: createJSONStorage(() => sessionStorage),
  })
);

export const newPostCommands: CommandType[] = [
  {
    name: 'Feedback (send cast to @hellno)',
    aliases: ['opinion', 'debrief'],
    icon: TagIcon,
    shortcut: 'cmd+shift+f',
    action: () => useNewPostStore.getState().addFeedbackDraft(),
    navigateTo: '/post',
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: 'New Post',
    aliases: ['new cast', 'write', 'create', 'compose', 'new draft'],
    icon: PlusCircleIcon,
    shortcut: 'c',
    action: () => {
      const { setCastModalView, openNewCastModal } = useNavigationStore.getState();
      setCastModalView(CastModalView.New);
      openNewCastModal();
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
    action: () => useNewPostStore.getState().removeAllPostDrafts(),
    navigateTo: '/post',
  },

];
