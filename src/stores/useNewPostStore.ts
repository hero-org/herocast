import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from "../../src/common/constants/commands";
import { PlusCircleIcon, TagIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AccountObjectType } from "./useAccountStore";
import { trackEventWithProperties } from "../../src/common/helpers/analytics";
import { DraftStatus, DraftType, ParentCastIdType } from "../../src/common/constants/farcaster";
import {
  getMentionFidsByUsernames,
  formatPlaintextToHubCastMessage,
} from '@mod-protocol/farcaster';
import { submitCast } from "@/common/helpers/farcaster";
import { toHex } from "viem";
import { CastId, Embed } from "@farcaster/hub-web";

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

type addNewPostDraftProps = {
  text?: string
  parentUrl?: string
  parentCastId?: ParentCastIdType
};


interface NewPostStoreProps {
  drafts: DraftType[];
  isToastOpen: boolean;
}

interface NewPostStoreActions {
  setIsToastOpen: (isToastOpen: boolean) => void;
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewPostDraft: ({ text, parentCastId, parentUrl }: addNewPostDraftProps) => void;
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
  isToastOpen: false,
  addNewPostDraft: ({ text, parentUrl, parentCastId }: addNewPostDraftProps) => {
    set((state) => {
      const newDraft = { ...NewPostDraft, text: text || '', parentUrl, parentCastId };
      if (!text && !parentUrl && !parentCastId) {
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if (!draft.text) {
            return
          }
        }
      }
      if (parentUrl || parentCastId) {
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if ((parentUrl && parentUrl === draft.parentUrl) ||
            (parentCastId && parentCastId.hash === draft.parentCastId?.hash)) {
            return;
          }
        }
      }

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
  publishPostDraft: async (draftIdx: number, account: { privateKey: string, platformAccountId: string }, onPost?: () => null): Promise<void> => {
    set(async (state) => {
      const draft = state.drafts[draftIdx];

      try {
        state.updatePostDraft(draftIdx, { ...draft, status: DraftStatus.publishing });
        const castBody: {
          text: string;
          embeds?: Embed[] | undefined;
          embedsDeprecated?: string[];
          mentions?: number[];
          mentionsPositions?: number[];
          parentCastId?: CastId | { fid: number, hash: string };
        } | false = await formatPlaintextToHubCastMessage({
          text: draft.text,
          embeds: draft.embeds,
          getMentionFidsByUsernames: getMentionFids,
          parentUrl: draft.parentUrl,
          parentCastFid: Number(draft.parentCastId?.fid),
          parentCastHash: draft.parentCastId?.hash,
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

        await submitCast({
          ...castBody,
          signerPrivateKey: account.privateKey,
          fid: Number(account.platformAccountId),
        });

        await new Promise(f => setTimeout(f, 100));
        trackEventWithProperties('publish_post', { authorFid: account.platformAccountId });
        state.removePostDraft(draftIdx);
        state.setIsToastOpen(true);

        if (onPost) onPost();
      } catch (error) {
        console.log('caught error in newPostStore', error)
        return `Error when posting ${error}`;
      }
    });
  },
  setIsToastOpen: (isToastOpen: boolean) => {
    set((state) => {
      state.isToastOpen = isToastOpen;
    });
  }
});
export const useNewPostStore = create<NewPostStore>()(devtools(mutative(store)));

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
    action: () => useNewPostStore.getState().addNewPostDraft({}),
    preventDefault: true,
    navigateTo: '/post',
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
