import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from "../common/constants/commands";
import { PlusCircleIcon, TagIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AccountObjectType } from "./useAccountStore";
import { trackEventWithProperties } from "../common/helpers/analytics";
import { LocalDraftStatus, DraftType, ParentCastIdType } from "../common/constants/farcaster";
import {
  getMentionFidsByUsernames,
  formatPlaintextToHubCastMessage,
} from '@mod-protocol/farcaster';
import { submitCast } from "@/common/helpers/farcaster";
import { toHex } from "viem";
import { CastId, Embed } from "@farcaster/hub-web";
import { toast } from "sonner";
import truncate from "lodash.truncate";
import { AccountPlatformType } from "@/common/constants/accounts";
import { createClient } from "@/common/helpers/supabase/component";

const getMentionFids = getMentionFidsByUsernames(process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!);
const supabaseClient = createClient();

export const NewPostDraft: DraftType = {
  text: "",
  parentUrl: undefined,
  parentCastId: undefined,
  status: LocalDraftStatus.writing,
  mentionsToFids: {},
};


const NewFeedbackPostDraft: DraftType = {
  text: "hey @hellno, feedback on @herocast: ",
  parentUrl: "https://herocast.xyz",
  status: LocalDraftStatus.writing,
  mentionsToFids: { 'herocast': '18665', 'hellno': '13596' }
};

export const JoinedHerocastPostDraft: DraftType = {
  text: "I just joined @herocast! ",
  status: LocalDraftStatus.writing,
  mentionsToFids: { 'herocast': '18665' }
}

export const JoinedHerocastViaHatsProtocolDraft: DraftType = {
  text: "I just joined @herocast via @hatsprotocol",
  status: LocalDraftStatus.writing,
  mentionsToFids: { 'herocast': '18665', 'hatsprotocol': '18484' }
}

type addNewLocalDraftProps = {
  text?: string
  parentUrl?: string
  parentCastId?: ParentCastIdType
};


interface LocalDraftStoreProps {
  drafts: DraftType[];
}

interface LocalDraftStoreActions {
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewLocalDraft: ({ text, parentCastId, parentUrl }: addNewLocalDraftProps) => void;
  addFeedbackDraft: () => void;
  removePostDraft: (draftId: number, onlyIfEmpty?: boolean) => void;
  removeAllPostDrafts: () => void;
  publishPostDraft: (draftIdx: number, account: AccountObjectType, onPost?: () => void) => Promise<string | null>;
  schedulePostDraft: (draftIdx: number, account: AccountObjectType) => Promise<string | null>;
}

export interface LocalDraftStore extends LocalDraftStoreProps, LocalDraftStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<LocalDraftStore>) => void) => void;

const store = (set: StoreSet) => ({
  drafts: [],
  addNewLocalDraft: ({ text, parentUrl, parentCastId }: addNewLocalDraftProps) => {
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
      console.log('removingPostDraft')
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
      const draft = state.drafts[draftIdx];

      try {
        state.updatePostDraft(draftIdx, { ...draft, status: LocalDraftStatus.publishing });
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


        if (account.platform === AccountPlatformType.farcaster_local_readonly) {
          toast.info('You\'re using a readonly account', { description: '<a href="/login">Switch to a full account to start casting ↗️</a>', descriptionClassName: "underline" })
        }

        await submitCast({
          ...castBody,
          signerPrivateKey: account.privateKey!,
          fid: Number(account.platformAccountId),
        });

        trackEventWithProperties('publish_post', { authorFid: account.platformAccountId });
        state.removePostDraft(draftIdx);
        toast.success('Cast published successfully', { description: truncate(draft.text, { length: 25 }) });

        if (onPost) onPost();
      } catch (error) {
        console.log('caught error in newPostStore', error)
        return `Error when posting ${error}`;
      }
    });
  },
});
export const useLocalDraftStore = create<LocalDraftStore>()(devtools(mutative(store)));

export const localDraftCommands: CommandType[] = [
  {
    name: 'Feedback (send cast to @hellno)',
    aliases: ['opinion', 'debrief'],
    icon: TagIcon,
    shortcut: 'cmd+shift+f',
    action: () => useLocalDraftStore.getState().addFeedbackDraft(),
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
    action: () => useLocalDraftStore.getState().addNewLocalDraft({}),
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
    action: () => useLocalDraftStore.getState().removeAllPostDrafts(),
    navigateTo: '/post',
  },

];
