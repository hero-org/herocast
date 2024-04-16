// needs to be wrapped in <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
import React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";

type HotkeyTooltipWrapperProps = {
  hotkey?: string | React.ReactNode;
  side: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
};

const HotkeyTooltipWrapper = ({
  hotkey,
  side,
  children,
}: HotkeyTooltipWrapperProps) => {
  if (!hotkey) return children;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        align={"center"}
        className="bg-background border border-muted text-foreground/80"
        side={side}
        sideOffset={5}
      >
        {hotkey}
      </TooltipContent>
    </Tooltip>
  );
};

export default HotkeyTooltipWrapper;
