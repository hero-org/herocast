import create, { State } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import isEqual from 'lodash.isequal';

type PostType = {
  text: string;
  media: string;
  replyTo: string;
  channel: string;
}

const NewPostDraft: PostType = {
  text: "",
  media: "",
  replyTo: "",
  channel: "",
};

const NewFeedbackPostDraft: PostType = {
  text: "hey @hellno, feedback on herocast: ",
  media: "",
  replyTo: "",
  channel: "",
};

interface NewPostStoreProps {
  postDrafts: PostType[];
}

interface NewPostStoreProps {
  updatePostDraftText: (draftId: number, text: string) => void;
  addNewPostDraft: () => void;
  addFeedbackDraft: () => void;
  removePostDraft: (draftId: number) => void;
  removeAllPostDrafts: () => void;
  publishPostDraft: (draftId: number) => void;
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
  publishPostDraft: (draftId: number) => {
    set((state) => {
      console.log("publishing post draft", state.postDrafts[draftId]);
      // call farsign api here
      state.postDrafts.splice(draftId, 1);
    });
  }
});
export const useNewPostStore = create<NewPostStore>()(devtools(mutative(store)));
