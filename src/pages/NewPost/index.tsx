import NewPostEntry from "@/common/components/NewPostEntry";
import { classNames } from "@/common/helpers/css";
import { useNewPostStore } from "@/stores/useNewPostStore";
import React, { useState } from "react";
import CustomToast from "@/common/components/CustomToast";
import { PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function NewPost() {
  const [showToast, setShowToast] = useState(false)

  const {
    addNewPostDraft,
    removeAllPostDrafts,
  } = useNewPostStore();
  const postDrafts = useNewPostStore(state => state.drafts);

  return (
    <>
      <div className="flex flex-col w-full max-w-md lg:max-w-2xl xl:max-w-4xl">
        <div className="w-full flex items-center justify-between">
          <div className="text-gray-100 font-semibold">You have {postDrafts.length} {postDrafts.length !== 1 ? 'drafts' : 'draft'}</div>
          <div>
            <button
              onClick={() => addNewPostDraft({})}
              className={classNames(
                "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600",
                "mr-2 inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
              )}
            >
              New draft
              <PlusCircleIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
            </button>
            <button
              disabled={postDrafts.length === 0}
              onClick={() => removeAllPostDrafts()}
              className={classNames(
                postDrafts.length > 0 ? "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600" : "cursor-default",
                "inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
              )}
            >
              Remove all drafts
              <TrashIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
            </button>
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
