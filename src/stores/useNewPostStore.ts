import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import isEqual from 'lodash.isequal';
import { CommandType } from "@/common/constants/commands";
import { TagIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/20/solid";
import { convertEditorCastToPublishableCast, publishCast } from "@/common/helpers/farcaster";
import { AccountObjectType } from "./useAccountStore";
import { trackEventWithProperties } from "@/common/helpers/analytics";

type PostEmbedType = {
  url: string;
};

export type PostType = {
  text: string;
  embeds?: PostEmbedType[];
  parentHash?: string;
  parentUrl?: string;
}

const NewPostDraft: PostType = {
  text: "",
};

const NewFeedbackPostDraft: PostType = {
  text: "hey @hellno, feedback on @herocast: ",
  parentUrl: "https://herocast.xyz"
};

interface NewPostStoreProps {
  postDrafts: PostType[];
}

interface NewPostStoreProps {
  updatePostDraft: (draftId: number, post: PostType) => void;
  updatePostDraftText: (draftId: number, text: string) => void;
  addNewPostDraft: () => void;
  addFeedbackDraft: () => void;
  removePostDraft: (draftId: number) => void;
  removeAllPostDrafts: () => void;
  publishPostDraft: (draftId: number, account: AccountObjectType) => Promise<void>;
}

export interface NewPostStore extends NewPostStoreProps, NewPostStoreProps { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NewPostStore>) => void) => void;

const store = (set: StoreSet) => ({
  postDrafts: [NewPostDraft],
  addNewPostDraft: () => {
    set((state) => {
      for (let i = 0; i < state.postDrafts.length; i++) {
        if (isEqual(NewPostDraft, state.postDrafts[i])) return;
      }
      state.postDrafts.push(NewPostDraft);
    });
  },
  addFeedbackDraft: () => {
    set((state) => {
      state.postDrafts.push(NewFeedbackPostDraft);
    });
  },
  updatePostDraft: (draftId: number, post: PostType) => {
    set((state) => {
      state.postDrafts[draftId] = post;
    });
  },
  updatePostDraftText: (draftId: number, text: string) => {
    set((state) => {
      state.postDrafts[draftId].text = text;
    });
  },
  removePostDraft: (draftId: number) => {
    set((state) => {
      state.postDrafts.splice(draftId, 1);
    });
  },
  removeAllPostDrafts: () => {
    set((state) => {
      state.postDrafts = [NewPostDraft];
    });
  },
  publishPostDraft: async (draftId: number, account: { privateKey: string, platformAccountId: string }): string => {
    set(async (state) => {
      try {
        const draft = state.postDrafts[draftId];
        console.log("publishPostDraft", draft);

        const castBody = convertEditorCastToPublishableCast(draft.text);
        await publishCast({
          castBody,
          privateKey: account.privateKey,
          authorFid: account.platformAccountId,
        }).then((res) => {
          console.log('res', res);
        }).catch((err) => {
          console.log('err', err);
        })
        trackEventWithProperties('publish_post', { authorFid: account.platformAccountId });
        state.removePostDraft(draftId);
      } catch (error) {
        return `Error when posting ${error}`;
      }
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
    // action: () => {
    //   openWindow("mailto:hellnomail@proton.me?subject=about herocast&body=hey @hellno, feedback on herocast: ");
    // },
    enableOnFormTags: true,
    navigateTo: '/post'
  },
  {
    name: 'New Post',
    aliases: ['new cast',],
    icon: PencilSquareIcon,
    shortcut: 'c',
    action: () => useNewPostStore.getState().addNewPostDraft(),
    enableOnFormTags: false,
    requiresNavigationState: [],
    navigateTo: '/post'
  }
];
