import React, { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { addToClipboard } from "../helpers/clipboard";

type ClickToCopyTextProps = {
  className?: string;
  buttonText?: string;
  text: string;
  disabled?: boolean;
  size?: "sm" | "lg";
};

const ClickToCopyText = ({
  className,
  disabled,
  buttonText,
  text,
  size = "lg"
}: ClickToCopyTextProps) => {
  const [didClickCopyShare, setDidClickCopyShare] = useState(false);

  const getButtonText = () => {
    if (didClickCopyShare) return "Copied";
    if (buttonText) return buttonText;
    return "Copy";
  };

  return (
    <Button
      variant="outline"
      size={size}
      className={cn("flex gap-x-1 px-2", className)}
      disabled={didClickCopyShare || disabled}
      onClick={() => {
        setDidClickCopyShare(true);
        addToClipboard(text);
        setTimeout(() => {
          setDidClickCopyShare(false);
        }, 2000);
      }}
    >
      {getButtonText()}
      <ClipboardDocumentIcon
        className={clsx(
          size === "sm" ? "h-4 w-4" : "h-5 w-5", "mt-0.5",
          didClickCopyShare ? "text-muted-foreground" : "text-foreground"
        )}
      />
    </Button>
  );
};

export default ClickToCopyText;
