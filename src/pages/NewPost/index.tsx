import NewPostEntry from "@/common/components/NewPostEntry";
import { classNames } from "@/common/helpers/css";
import { useNewPostStore } from "@/stores/useNewPostStore";
import React, { useState } from "react";
import CustomToast from "@/common/components/CustomToast";

export default function NewPost() {
  const [showToast, setShowToast] = useState(false)

  const {
    removeAllPostDrafts,
  } = useNewPostStore();
  const postDrafts = useNewPostStore(state => state.drafts);

  console.log('NewPost page drafts', postDrafts)

  return (
    <>
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
        <div className="w-1/2 divide-y">
          {postDrafts.map((draft, draftIdx) =>
            <div key={draftIdx} className="pt-4 pb-6">
              {draft.parentCastId?.hash && (
                <div className="text-gray-400 text-sm mb-2">
                  Replying to <span className="text-gray-100">@{draft.parentCastId?.hash}</span>
                </div>
              )}
              <NewPostEntry
                key={`draft-${draftIdx}`}
                draftIdx={draftIdx}
                onPost={() => null}
              // draft={draft}
              // onChange={(cast: PostType) => updatePostDraft(draftIdx, cast)}
              // onSubmit={(e: React.FormEvent<HTMLFormElement>) => onSubmit(e, draft, draftIdx)}
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
    </>
  )
}
