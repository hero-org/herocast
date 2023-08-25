import NewPostEntry from "@/common/components/NewPostEntry";
import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import { PostType, useNewPostStore } from "@/stores/useNewPostStore";
import React, { useState } from "react";
import { convertEditorCastToPublishableCast, publishCast } from "@/common/helpers/farcaster";
import CustomToast from "@/common/components/CustomToast";
import * as Toast from '@radix-ui/react-toast';


export default function NewPost() {
  const [showToast, setShowToast] = useState(false)

  const {
    postDrafts,
    updatePostDraftText,
    removeAllPostDrafts,
    publishPostDraft,
  } = useNewPostStore();
  const {
    accounts,
    selectedAccountIdx
  } = useAccountStore();

  const account = accounts[selectedAccountIdx];

  const onSubmitPost = async ({ draft, draftIdx }: { draft: PostType, draftIdx: number }) => {
    console.log('onSubmitPost', { draft, draftIdx })

    if (draft.text.length > 0) {
      if (!account.privateKey || !account.platformAccountId) {
        return;
      }
      publishPostDraft(draftIdx, account).then(() => {
        setShowToast(true);
      }).catch((err) => {
        console.log('error publishing post draft', err);
      });
    }
  }
  return (
    <>
      <Toast.Provider swipeDirection="right">
        <div className="flex flex-col min-w-full">
          <div className="min-w-full flex items-center justify-between">
            <div className="text-gray-100 font-semibold">You have {postDrafts.length} {postDrafts.length !== 1 ? 'drafts' : 'draft'}</div>
            <div
              onClick={() => removeAllPostDrafts()}
              className={classNames(
                postDrafts.length > 1 ? "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600" : "cursor-default",
                "inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
              )}
            >
              Remove all drafts
            </div>
          </div>
          <div className="max-w-fit divide-y">
            {postDrafts.map((draft, draftIdx) =>
              <div key={draftIdx} className="pt-4 pb-6">
                <NewPostEntry
                  key={`draft-${draftIdx}`}
                  draft={draft}
                  onTextChange={(text: string) => updatePostDraftText(draftIdx, text)}
                  onSubmit={() => onSubmitPost({ draft, draftIdx })}
                />
              </div>
            )}
          </div>
        </div>
        <CustomToast
          title="Cast published successfully"
          showToast={showToast}
          setShowToast={setShowToast}
        />
        <Toast.Viewport className="[--viewport-padding:_25px] fixed bottom-0 right-0 flex flex-col p-[var(--viewport-padding)] gap-[10px] w-[390px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none" />
      </Toast.Provider>
    </>
  )
}
