import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useNewPostStore } from "../../src/stores/useNewPostStore";
import React, { useEffect, useState } from "react";
import CustomToast from "../../src/common/components/CustomToast";
import { PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";
import { Button } from "../../src/components/ui/button";

export default function NewPost() {
  const [showToast, setShowToast] = useState(false);

  const { addNewPostDraft, removeAllPostDrafts } = useNewPostStore();
  const { drafts } = useNewPostStore();

  useEffect(() => {
    if (drafts.length === 0) {
      addNewPostDraft({});
    }
  }, []);

  return (
    <>
      <div className="ml-3 flex flex-col md:w-full lg:max-w-md xl:max-w-lg">
        <div className="ml-1 mt-2 w-full flex items-center justify-between">
          <div className="text-foreground/80 font-semibold">
            You have {drafts.length}{" "}
            {drafts.length !== 1 ? "drafts" : "draft"}
          </div>
          <div className="flex ml-8 lg:ml-0">
            <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey={`c`} side="bottom">
                <Button
                  onClick={() => addNewPostDraft({})}
                  className="mr-2 inline-flex items-center"
                >
                  New draft
                  <PlusCircleIcon
                    className="hidden md:block ml-1.5 mt-0.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </HotkeyTooltipWrapper>
            </Tooltip.Provider>

            <Button
              variant="outline"
              disabled={drafts.length === 0}
              onClick={() => removeAllPostDrafts()}
              className={classNames(
                drafts.length > 0
                  ? "cursor-pointer"
                  : "cursor-default",
                "inline-flex items-center"
              )}
            >
              Remove all drafts
              <TrashIcon
                className="hidden md:block ml-1.5 mt-0.5 h-4 w-4"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
        <div className="divide-y">
          {drafts.map((draft, draftIdx) => (
            <div key={draftIdx} className="pt-4 pb-6">
              {draft.parentCastId?.hash && (
                <div className="text-foreground/70 text-sm mb-2">
                  Replying to{" "}
                  <span className="text-foreground/80">
                    @{draft.parentCastId?.hash}
                  </span>
                </div>
              )}
              <NewPostEntry
                draft={draft}
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
