import React, { useState } from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClickToCopyTextProps = {
  className?: string;
  buttonText?: string;
  text: string;
};

const ClickToCopyText = ({
  className,
  buttonText,
  text,
}: ClickToCopyTextProps) => {
  const [didClickCopyShare, setDidClickCopyShare] = useState(false);

  return (
    <Button
      variant="outline"
      size="lg"
      className={cn("flex gap-x-2 px-2", className)}
      disabled={didClickCopyShare}
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
  );
};

export default ClickToCopyText;
