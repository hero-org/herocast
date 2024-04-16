import React, { useState } from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

const ClickToCopyText = ({ text }: { text: string }) => {
  const [didClickCopyShare, setDidClickCopyShare] = useState(false);

  return (
    <div className="flex flex-row text-center items-center">
      <Button
        variant="secondary"
        className="flex gap-x-2"
        onClick={() => {
          setDidClickCopyShare(true);
          navigator.clipboard.writeText(text);
          setTimeout(() => {
            setDidClickCopyShare(false);
          }, 2000);
        }}
      >
        <ClipboardDocumentIcon
          className={clsx(
            "h-5 w-5 mt-0.5",
            didClickCopyShare ? "text-muted-foreground" : "text-foreground"
          )}
        />
        {didClickCopyShare ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
};

export default ClickToCopyText;
