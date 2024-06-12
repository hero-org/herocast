import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useNewPostStore } from "../../src/stores/useDraftStore";
import React, { useEffect, useState } from "react";
import {
  ClockIcon,
  PlusCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";
import { Button } from "../../src/components/ui/button";
import { CastRow } from "@/common/components/CastRow";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NewPost() {
  const { addNewPostDraft, removePostDraft, removeAllPostDrafts } =
    useNewPostStore();
  const { drafts } = useNewPostStore();
  const [parentCasts, setParentCasts] = useState<CastWithInteractions[]>([]);
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const [activeTab, setActiveTab] = useState("drafts");
  const [selectedDraftIdx, setSelectedDraftIdx] = useState(0);

  useEffect(() => {
    if (drafts.length === 0) {
      addNewPostDraft({});
    }
  }, []);

  useEffect(() => {
    const parentCastIds = drafts
      .map((draft) => draft?.parentCastId?.hash)
      .filter(Boolean) as string[];

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: selectedAccount?.platformAccountId,
      });
      setParentCasts(res?.result?.casts);
    };
    if (parentCastIds.length) {
      fetchParentCasts();
    }
  }, [drafts]);

  const renderDraft = (draft, draftIdx) => {
    const parentCast = parentCasts.find(
      (cast) => cast.hash === draft.parentCastId?.hash
    );
    return (
      <div key={draftIdx} className="pt-4 pb-6">
        {parentCast && <CastRow cast={parentCast} />}
        <NewPostEntry
          draft={draft}
          key={`draft-${draftIdx}`}
          draftIdx={draftIdx}
          onRemove={() => removePostDraft(draftIdx)}
        />
      </div>
    );
  };

  const renderDraftList = () => {
    return (
      <ScrollArea className="">
        <div className="flex flex-col gap-2 p-4 pt-0">
          <Button
            variant="outline"
            className="flex items-center gap-2 w-full"
            onClick={() => {
              addNewPostDraft({});
              setSelectedDraftIdx(drafts.length);
            }}
          >
            <PlusCircleIcon className="w-5 h-5" />
            <span>New draft</span>
          </Button>

          {drafts.map((draft, draftIdx) => (
            <button
              key={draft?.id}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                draftIdx === selectedDraftIdx && "bg-muted"
              )}
              onClick={() => {
                setSelectedDraftIdx(draftIdx);
              }}
            >
              <div className="line-clamp-2 text-xs text-muted-foreground">
                {draft.text.substring(0, 300)}
              </div>
              <div className="flex w-full flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div>
                    {draft?.embeds?.length ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {draft.embeds.length} embeds
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "ml-auto text-xs",
                      draftIdx === selectedDraftIdx
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    8mins ago
                  </div>
                  <Button
                    className="p-0"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      removePostDraft(draftIdx);
                    }}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs font-medium"></div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="grid grid-cols-[300px_1fr] h-screen w-full">
      <div className="overflow-y-auto p-4">
        <div className="space-y-4">
          <Tabs>
            <div className="flex items-center justify-between">
              <Tabs
                defaultValue="drafts"
                className="w-full"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <div className="flex items-center px-4 py-2">
                  <TabsList className="flex ml-auto">
                    <TabsTrigger
                      value="drafts"
                      className="text-zinc-600 dark:text-zinc-200"
                    >
                      Drafts
                    </TabsTrigger>
                    <TabsTrigger
                      value="scheduled"
                      className="text-zinc-600 dark:text-zinc-200"
                    >
                      Scheduled
                    </TabsTrigger>
                    <TabsTrigger
                      value="posted"
                      className="text-zinc-600 dark:text-zinc-200"
                    >
                      Posted
                    </TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
            </div>
            <TabsContent value="drafts"></TabsContent>
            <TabsContent value="scheduled"></TabsContent>
            <TabsContent value="posted"></TabsContent>
            {renderDraftList()}
          </Tabs>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">New cast</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {renderDraft(drafts[selectedDraftIdx], selectedDraftIdx)}
        </div>
      </div>
    </div>
  );
}
