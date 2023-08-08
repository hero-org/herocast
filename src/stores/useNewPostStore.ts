import create, { State } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';

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
}

export interface NewPostStore extends NewPostStoreProps, NewPostStoreProps { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NewPostStore>) => void) => void;

const store = (set: StoreSet) => ({
  postDrafts: [NewPostDraft],
  addNewPostDraft: () => {
    set((state) => {
      if (state.postDrafts[-1] === NewPostDraft) return;
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
  }
});
export const useNewPostStore = create<NewPostStore>()(devtools(mutative(store)));
