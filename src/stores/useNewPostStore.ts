import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { CommandType } from "@/common/constants/commands";
import { TagIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/20/solid";
import { convertEditorCastToPublishableCast, publishCast } from "@/common/helpers/farcaster";
import { AccountObjectType } from "./useAccountStore";
import { trackEventWithProperties } from "@/common/helpers/analytics";
import { ParentCastIdType, PostType } from "@/common/constants/farcaster";

export const NewPostDraft: PostType = {
  text: "",
  parentUrl: undefined,
  parentCastId: undefined,
};


const NewFeedbackPostDraft: PostType = {
  text: "hey @hellno, feedback on @herocast: ",
  parentUrl: "https://herocast.xyz"
};

type addNewPostDraftProps = {
  parentUrl?: string
  parentCastId?: ParentCastIdType
};


interface NewPostStoreProps {
  postDrafts: PostType[];
  isToastOpen: boolean;
};

interface NewPostStoreActions {
  setIsToastOpen: (isToastOpen: boolean) => void;
  updatePostDraft: (draftIdx: number, post: PostType) => void;
  addNewPostDraft: ({ parentCastId, parentUrl }: addNewPostDraftProps) => void;
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
  postDrafts: [NewPostDraft],
  isToastOpen: false,
  addNewPostDraft: ({ parentUrl, parentCastId }: addNewPostDraftProps) => {
    set((state) => {
      // console.log('addNewPostDraft', parentUrl, parentCastId);

      const newDraft = { ...NewPostDraft, parentUrl, parentCastId };
      for (let i = 0; i < state.postDrafts.length; i++) {
        if ((parentUrl && parentUrl === state.postDrafts[i].parentUrl) ||
          (parentCastId && parentCastId.hash === state.postDrafts[i].parentCastId?.hash)) {
          return;
        }
      }

      state.postDrafts.push(newDraft);
    });
  },
  addFeedbackDraft: () => {
    set((state) => {
      state.postDrafts.push(NewFeedbackPostDraft);
    });
  },
  updatePostDraft: (draftIdx: number, post: PostType) => {
    set((state) => {
      state.postDrafts = [
        ...(draftIdx > 0 ? state.postDrafts.slice(0, draftIdx) : []),
        post,
        ...state.postDrafts.slice(draftIdx + 1),
      ];
    });
  },
  removePostDraft: (draftIdx: number) => {
    set((state) => {
      state.postDrafts.splice(draftIdx, 1);
    });
  },
  removeAllPostDrafts: () => {
    set((state) => {
      state.postDrafts = [NewPostDraft];
    });
  },
  publishPostDraft: async (draftIdx: number, account: { privateKey: string, platformAccountId: string }) => {
    set(async (state) => {
      try {
        const draft = state.postDrafts[draftIdx];
        // console.log("publishPostDraft", draft);

        const castBody = await convertEditorCastToPublishableCast(draft, account.platformAccountId);
        // console.log("converted castBody", JSON.stringify({ ...castBody }));

        publishCast({
          castBody,
          privateKey: account.privateKey,
          authorFid: account.platformAccountId,
        }).then((res) => {
          trackEventWithProperties('publish_post', { authorFid: account.platformAccountId });
          state.removePostDraft(draftIdx);
          state.setIsToastOpen(true);
        }).catch((err) => {
          console.log('err', err);
        })

      } catch (error) {
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
