import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useLocalDraftStore } from "../../src/stores/useLocalDraftStore";
import React, { ReactNode, useEffect, useState } from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";
import { Button } from "../../src/components/ui/button";
import { useAccountStore } from "../../src/stores/useAccountStore";
import { DraftStatusType } from "../../src/common/constants/accounts";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import get from "lodash.get";

const draftStatusToIcon = {
  [DraftStatusType.writing]: (
    <PencilSquareIcon className="h-5 w-5 text-background" aria-hidden="true" />
  ),
  [DraftStatusType.scheduled]: (
    <CalendarDaysIcon className="h-5 w-5 text-background" aria-hidden="true" />
  ),
  [DraftStatusType.published]: (
    <CheckIcon className="h-5 w-5 text-background" aria-hidden="true" />
  ),
  [DraftStatusType.error]: (
    <ExclamationTriangleIcon
      className="h-5 w-5 text-background"
      aria-hidden="true"
    />
  ),
};

export default function NewPost() {
  const { drafts, addNewLocalDraft, removeAllPostDrafts } = useLocalDraftStore();
  const { removeScheduledDraft } = useAccountStore();
  const selectedAccount = useAccountStore(
    (state) => state.accounts?.[state.selectedAccountIdx]
  );

  console.log('selectedAccount drafts', selectedAccount?.drafts)

  useEffect(() => {
    if (drafts.length === 0) {
      addNewLocalDraft({});
    }
  }, []);

  const getIconForDraftStatus = (status: DraftStatusType) => {
    const icon = get(draftStatusToIcon, status);
    return (
      <span
        className={classNames(
          "bg-foreground",
          "h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white"
        )}
      >
        {icon}
      </span>
    );
  };

  const renderScheduledDraftTimeline = () => (
    <div className="mt-8">
      <div className="text-foreground/80 font-semibold">
        You have scheduled {selectedAccount?.drafts.length}{" "}
        {selectedAccount?.drafts.length !== 1 ? "drafts" : "draft"}
      </div>
      <ul role="list" className="mt-4 -mb-8">
        {selectedAccount?.drafts.map((draft, draftIdx) => (
          <li key={draft.id}>
            <div className="relative pb-8">
              {draftIdx !== selectedAccount.drafts.length - 1 ? (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>{getIconForDraftStatus(draft.status)}</div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-gray-500">{draft.data?.text} </p>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                    <time dateTime={draft.scheduledFor}>
                      {draft.scheduledFor}
                    </time>
                    <Button
                      onClick={() => removeScheduledDraft(draft.id)}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <div className="mx-3 flex flex-col md:w-full lg:max-w-md xl:max-w-lg">
        <div className="mt-2 w-full flex items-center justify-between">
          <div className="text-foreground/80 font-semibold">
            You have {drafts.length} {drafts.length !== 1 ? "drafts" : "draft"}
          </div>
          <div className="flex ml-8 lg:ml-0">
            <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey={`c`} side="bottom">
                <Button
                  onClick={() => addNewLocalDraft({})}
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
                drafts.length > 0 ? "cursor-pointer" : "cursor-default",
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
        {renderScheduledDraftTimeline()}
      </div>
    </>
  );
}
