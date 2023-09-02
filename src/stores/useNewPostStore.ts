import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from "@/common/constants/commands";
import { TagIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/20/solid";
import { convertEditorCastToPublishableCast, publishCast } from "@/common/helpers/farcaster";
import { AccountObjectType } from "./useAccountStore";
import { trackEventWithProperties } from "@/common/helpers/analytics";
import { DraftStatus, DraftType, ParentCastIdType } from "@/common/constants/farcaster";

export const NewPostDraft: DraftType = {
  text: "",
  parentUrl: undefined,
  parentCastId: undefined,
  status: DraftStatus.writing,
  mentionsToFids: { 'x': 'y' }
};


const NewFeedbackPostDraft: DraftType = {
  text: "hey @hellno, feedback on @herocast: ",
  parentUrl: "https://herocast.xyz",
  status: DraftStatus.writing,
  mentionsToFids: { 'herocast': '18665', 'hellno': '13596' }
};

export const JoinedHerocastPostDraft: DraftType = {
  text: "I just joined @herocast!",
  status: DraftStatus.writing,
  mentionsToFids: { 'herocast': '18665' }
}

type addNewPostDraftProps = {
  text?: string
  parentUrl?: string
  parentCastId?: ParentCastIdType
};


interface NewPostStoreProps {
  drafts: DraftType[];
  isToastOpen: boolean;
};

interface NewPostStoreActions {
  setIsToastOpen: (isToastOpen: boolean) => void;
  updatePostDraft: (draftIdx: number, post: DraftType) => void;
  updateMentionsToFids: (draftIdx: number, mentionsToFids: { [key: string]: string }) => void;
  addNewPostDraft: ({ text, parentCastId, parentUrl }: addNewPostDraftProps) => void;
  addFeedbackDraft: () => void;
  removePostDraft: (draftId: number) => void;
  removeAllPostDrafts: () => void;
  publishPostDraft: (draftIdx: number, account: AccountObjectType) => Promise<void>;
}

export interface NewPostStore extends NewPostStoreProps, NewPostStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NewPostStore>) => void) => void;

const store = (set: StoreSet) => ({
  drafts: [NewPostDraft],
  isToastOpen: false,
  addNewPostDraft: ({ text, parentUrl, parentCastId }: addNewPostDraftProps) => {
    set((state) => {
      // console.log('addNewPostDraft', parentUrl, parentCastId);

      const newDraft = { ...NewPostDraft, text: text || '', parentUrl, parentCastId };
      for (let i = 0; i < state.drafts.length; i++) {
        if ((parentUrl && parentUrl === state.drafts[i].parentUrl) ||
          (parentCastId && parentCastId.hash === state.drafts[i].parentCastId?.hash)) {
          return;
        }
      }

      state.drafts.push(newDraft);
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
      // console.log("updateMentionsToFids", draftIdx, Object.entries(mentionsToFids));
      // state.drafts[draftIdx].mentionsToFids = mentionsToFids;

      const draft = state.drafts[draftIdx];
      state.drafts = [
        ...(draftIdx > 0 ? state.drafts.slice(0, draftIdx) : []),
        { ...draft, mentionsToFids },
        ...state.drafts.slice(draftIdx + 1),
      ];
    });
  },
  removePostDraft: (draftIdx: number) => {
    set((state) => {
      // console.log('removePostDraft', draftIdx);
      // console.log('len before', state.drafts.length)

      if (state.drafts.length === 1) {
        state.drafts = [NewPostDraft];
        return;
      } else {
        state.drafts = state.drafts.splice(draftIdx, 1);
      }
      // console.log('len after', state.drafts.length)
    });
  },
  removeAllPostDrafts: () => {
    set((state) => {
      state.drafts = [NewPostDraft];
    });
  },
  publishPostDraft: async (draftIdx: number, account: { privateKey: string, platformAccountId: string }) => {
    set(async (state) => {
      const draft = state.drafts[draftIdx];

      try {
        state.updatePostDraft(draftIdx, { ...draft, status: DraftStatus.publishing });
        const castBody = await Promise.resolve(convertEditorCastToPublishableCast(draft, account.platformAccountId));
        // console.log("converted castBody", JSON.stringify({ ...castBody }));

        await Promise.resolve(publishCast({
          castBody,
          privateKey: account.privateKey,
          authorFid: account.platformAccountId,
        })).then((res) => {
          if (res.error) {
            console.log('publishPostdraft error:', res.error);
            return;
          }
          trackEventWithProperties('publish_post', { authorFid: account.platformAccountId });
          state.removePostDraft(draftIdx);
          state.setIsToastOpen(true);
        }).catch((err) => {
          console.log('publishPostdraft caught error:', err);
        })

      } catch (error) {
        return `Error when posting ${error}`;
      } finally {
        state.updatePostDraft(draftIdx, { ...draft, status: DraftStatus.published });
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
    enableOnFormTags: true,
    navigateTo: '/post'
  },
  {
    name: 'New Post',
    aliases: ['new cast',],
    icon: PencilSquareIcon,
    shortcut: 'c',
    action: () => useNewPostStore.getState().addNewPostDraft({}),
    enableOnFormTags: false,
    requiresNavigationState: [],
    navigateTo: '/post'
  }
];
