// needs to be wrapped in <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
import React from "react";
import * as Tooltip from '@radix-ui/react-tooltip';
import { KeyboardIcon } from '@radix-ui/react-icons';


type HotkeyTooltipWrapperProps = {
  hotkey: string;
  side: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

const HotkeyTooltipWrapper = ({ hotkey, side, children }: HotkeyTooltipWrapperProps) => {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          align={"center"}
          className="flex text-foreground data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade text-violet11 select-none rounded-[4px] bg-gray-700 px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity]"
          side={side}
          sideOffset={5}
        >
          <KeyboardIcon className="mr-2" />
          {hotkey}
          <Tooltip.Arrow className="fill-gray-700" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export default HotkeyTooltipWrapper;
