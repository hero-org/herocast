import NewPostEntry from "@/common/components/NewPostEntry";
import { classNames } from "@/common/helpers";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { useToast } from "@chakra-ui/react";
import { XMarkIcon } from '@heroicons/react/20/solid';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import React from "react";

export default function NewPost() {
  const toast = useToast()
  const toastIdRef = React.useRef()

  const {
    postDrafts,
    updatePostDraftText,
    removeAllPostDrafts,
    publishPostDraft,
  } = useNewPostStore();

  const onSubmitPost = (draft, draftId) => {

    function closeToast() {
      if (toastIdRef.current) {
        toast.close(toastIdRef.current)
      }
    }
    if (draft.text.length > 0) {
      console.log('submitting post', draft.text)
      toastIdRef.current = toast({
        position: 'bottom-left',
        status: 'success',
        duration: 9000,
        render: () => (
          <div className="w-full pointer-events-auto w-full max-w-sm overflow-hidden rounded-sm bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-100" aria-hidden="true" />
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-200">Post published</p>
                  <p className="mt-1 text-sm text-gray-200 truncate">{draft.text}</p>
                </div>
                <div className="ml-4 flex flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-gray-800 text-gray-200 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    onClick={() => closeToast()}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
      })
      publishPostDraft(draftId)
    }
  }
  return (
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
        {postDrafts.map((draft, idx) =>
          <div className="pt-4 pb-6">
            <NewPostEntry
              key={`draft-${idx}`}
              draft={draft}
              onTextChange={(text: string) => updatePostDraftText(idx, text)}
              onSubmit={() => onSubmitPost(draft, idx)}
            />
          </div>
        )}
      </div>
    </div>)
}
