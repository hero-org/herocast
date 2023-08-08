import React from "react";
import { useNewPostStore } from "@/stores/useNewPostStore";
import NewPostEntry from "@/common/components/NewPostEntry";


export default function NewPost() {
  const {
    postDrafts,
    updatePostDraftText,
  } = useNewPostStore();
  return (<div className="space-y-4">
    {postDrafts.map((draft, idx) =>
      <NewPostEntry
        key={`draft-${idx}`}
        draft={draft}
        onTextChange={(text: string) => updatePostDraftText(idx, text)}
        onSubmit={() => alert(`yo ${draft.text}`)}
      />
    )}
  </div>)
}
