import React, { useEffect } from "react";
import Modal from "./Modal";
import NewPostEntry from "./NewPostEntry";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { CastRow, CastToReplyType } from "./CastRow";
import { useHotkeys } from "react-hotkeys-hook";
import { AccountSelector } from "./AccountSelector";
import { AccountStatusType } from "../constants/accounts";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";
import { toBytes, toHex } from "viem";

type NewCastModalProps = {
  linkedCast?: CastToReplyType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const findDraftIdForLinkedCast = (castModalView, drafts, linkedCast) => {
  if (!linkedCast || !drafts.length) return -1;

  console.log('findDraftIdForLinkedCast', castModalView, linkedCast?.hash)
  
  if (castModalView === CastModalView.Quote) {
    console.log('drafts.length', drafts)
    console.log('drafts.castId.hash', drafts.map(draft => draft?.embeds?.length ? toHex(draft?.embeds?.[0]?.castId.hash) : undefined))
    console.log('linkedCast.hash', linkedCast?.hash)
    return drafts.findIndex((draft) => draft?.embeds?.length && toHex(draft?.embeds?.[0]?.castId.hash) === linkedCast?.hash);
  } else if (castModalView === CastModalView.Reply) {
    return drafts.findIndex((draft) => draft.parentCastId && toHex(draft.parentCastId?.hash) === linkedCast?.hash);
  } else {
    // any empty draft
    return drafts.findIndex((draft) => !draft.text && !draft.embeds?.length && !draft.parentCastId);
  }
}

const NewCastModal = ({ linkedCast, open, setOpen }: NewCastModalProps) => {
  const { castModalView } = useNavigationStore();
  const { addNewPostDraft, drafts, removePostDraft } = useNewPostStore();
  const draftIdx = findDraftIdForLinkedCast(castModalView, drafts, linkedCast);
  console.log('draftIdx', draftIdx)
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (draftIdx === -1 && open) {
      console.log("adding new post draft in NewCastModal");
      if (!linkedCast) {
        addNewPostDraft({});
      } else {
        const castObj = {
          hash: toBytes(linkedCast.hash),
          fid: linkedCast.author.fid,
        };
        const options =
          castModalView === CastModalView.Quote
            ? { embeds: [{ castId: castObj }] }
            : { parentCastId: castObj };
        console.log("draft options", options);
        addNewPostDraft(options);
      }
    }
    return () => {
      if (open) return;

      if (draftIdx !== -1) {
        removePostDraft(draftIdx);
      }
    };
  }, [draftIdx, open]);

  useHotkeys("esc", () => setOpen(false), [open], {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    enabled: open,
  });

  const getTitle = () => {
    const verb = castModalView === CastModalView.Quote ? "Quote" : "Reply to";
    const username =
      linkedCast?.author.display_name || linkedCast?.author.displayName;
    const action = linkedCast ? `${verb} ${username}` : "New post";
    return (
      <span className="flex items-center">
        {action} as
        <AccountSelector
          className="ml-2 w-1/2"
          accountFilter={(account) =>
            account.status === AccountStatusType.active
          }
        />
      </span>
    );
  };

  return (
    <Modal title={getTitle()} open={open} setOpen={setOpen}>
      <div className="mt-2 overflow-auto">
        {open && draftIdx !== -1 && (
          <div
            className="flex flex-col max-w-full max-h-[calc(100vh-200px)]"
            key={`new-post-parentHash-${linkedCast?.hash}`}
          >
            <div className="mb-4">
              {linkedCast && (
                <CastRow cast={linkedCast} isSelected disableEmbeds />
              )}
            </div>
            <div className="flex">
              <NewPostEntry
                draft={draft}
                draftIdx={draftIdx}
                onPost={() => {
                  setOpen(false);
                }}
                hideChannel
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewCastModal;
