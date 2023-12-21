import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useNewPostStore } from "../../src/stores/useNewPostStore";
import React, { useEffect, useState } from "react";
import CustomToast from "../../src/common/components/CustomToast";
import { PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";

export default function NewPost() {
  const [showToast, setShowToast] = useState(false);

  const { addNewPostDraft, removeAllPostDrafts } = useNewPostStore();
  const postDrafts = useNewPostStore((state) => state.drafts);

  useEffect(() => {
    if (postDrafts.length === 0) {
      addNewPostDraft({});
    }
  }, []);

  return (
    <>
      <div className="ml-3 flex flex-col md:w-full lg:max-w-md xl:max-w-lg">
        <div className="ml-1 mt-2 w-full flex items-center justify-between">
          <div className="text-gray-100 font-semibold">
            You have {postDrafts.length}{" "}
            {postDrafts.length !== 1 ? "drafts" : "draft"}
          </div>
          <div className="flex ml-8 lg:ml-0">
            <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey={`c`} side="bottom">
                <button
                  onClick={() => addNewPostDraft({})}
                  className={classNames(
                    "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600",
                    "mr-2 inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
                  )}
                >
                  New draft
                  <PlusCircleIcon
                    className="hidden md:block ml-1.5 mt-0.5 h-4 w-4 text-gray-100"
                    aria-hidden="true"
                  />
                </button>
              </HotkeyTooltipWrapper>
            </Tooltip.Provider>

            <button
              disabled={postDrafts.length === 0}
              onClick={() => removeAllPostDrafts()}
              className={classNames(
                postDrafts.length > 0
                  ? "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
                  : "cursor-default",
                "inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
              )}
            >
              Remove all drafts
              <TrashIcon
                className="hidden md:block ml-1.5 mt-0.5 h-4 w-4 text-gray-100"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <div className="divide-y">
          {postDrafts.map((draft, draftIdx) => (
            <div key={draftIdx} className="pt-4 pb-6">
              {draft.parentCastId?.hash && (
                <div className="text-gray-400 text-sm mb-2">
                  Replying to{" "}
                  <span className="text-gray-100">
                    @{draft.parentCastId?.hash}
                  </span>
                </div>
              )}
              <NewPostEntry
                key={`draft-${draftIdx}`}
                draftIdx={draftIdx}
                onPost={() => null}
              />
            </div>
          ))}
        </div>
      </div>
      <CustomToast
        title="Cast published successfully"
        showToast={showToast}
        setShowToast={setShowToast}
      />
    </>
  );
}
