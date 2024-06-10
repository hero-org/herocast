/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */

import { AccountPlatformType } from "@/common/constants/accounts";
import { CommandType } from "@/common/constants/commands";
import {
  DraftStatus,
  DraftType,
  ParentCastIdType,
} from "@/common/constants/farcaster";
import { NewFeedbackPostDraft, NewPostDraft } from "@/common/constants/postDrafts";
import { submitCast } from "@/common/helpers/farcaster";
import {
  toastErrorCastPublish,
  toastInfoReadOnlyMode,
  toastSuccessCastPublished,
} from "@/common/helpers/toast";
import { CastId, Embed } from "@farcaster/hub-web";
import {
  PlusCircleIcon,
  TagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
import {
  formatPlaintextToHubCastMessage,
  getMentionFidsByUsernames,
} from "@mod-protocol/farcaster";
import { Draft, create as mutativeCreate } from "mutative";
import { toBytes, toHex } from "viem";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AccountObjectType } from "./useAccountStore";
import { CastModalView, useNavigationStore } from "./useNavigationStore";

const getMentionFids = getMentionFidsByUsernames(
  process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!,
);

type addNewPostDraftProps = {
  text?: string;
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  embeds?: FarcasterEmbed[];
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
  publishPostDraft: (
    draftIdx: number,
    account: AccountObjectType,
    onPost?: () => void,
  ) => Promise<string | null>;
  removeEmptyDrafts: () => void;
}

export interface NewPostStore extends NewPostStoreProps, NewPostStoreActions { }

export const mutative = (config) => (set, get) =>
  config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NewPostStore>) => void) => void;

const store = (set: StoreSet) => ({
  drafts: [],
  addNewPostDraft: ({ text, parentUrl, parentCastId, embeds }: addNewPostDraftProps) => {
    set((state) => {
      if (!text && !parentUrl && !parentCastId && !embeds) {
        // check if there is an existing empty draft
        for (let i = 0; i < state.drafts.length; i++) {
          const draft = state.drafts[i];
          if (!draft.text && !draft.parentUrl && !draft.parentCastId && !draft.embeds) {
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
  removeEmptyDrafts: () => {
    set((state) => {
      // removes empty drafts, and ensure no whitespace drafts are saved
      state.drafts = state.drafts.filter((draft) => Boolean(draft.text.trim()))
    })
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
export const useNewPostStore = create<NewPostStore>()(
  persist(mutative(store), {
    name: "herocast-post-store",
    storage: createJSONStorage(() => sessionStorage),
  }),
);

export const newPostCommands: CommandType[] = [
  {
    name: "Feedback (send cast to @hellno)",
    aliases: ["opinion", "debrief"],
    icon: TagIcon,
    shortcut: "cmd+shift+f",
    action: () => useNewPostStore.getState().addFeedbackDraft(),
    navigateTo: "/post",
    options: {
      enableOnFormTags: true,
    },
  },
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
    action: () => useNewPostStore.getState().removeAllPostDrafts(),
    navigateTo: "/post",
  },
];
