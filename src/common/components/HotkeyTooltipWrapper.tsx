// needs to be wrapped in <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

type HotkeyTooltipWrapperProps = {
  hotkey?: string | React.ReactNode;
  side: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
};

// Compact styling for tooltip context
const kbdClassName = 'h-5 min-w-5 px-1 text-[13px]';

const renderHotkey = (hotkey: string | React.ReactNode): React.ReactNode => {
  // If hotkey is already a ReactNode, render as-is for backwards compatibility
  if (typeof hotkey !== 'string') {
    return hotkey;
  }

  // Check if hotkey contains combination separator " + "
  if (hotkey.includes(' + ')) {
    const keys = hotkey.split(' + ');
    return (
      <KbdGroup className="gap-1">
        {keys.map((key, index) => (
          <Kbd key={index} className={kbdClassName}>
            {key}
          </Kbd>
        ))}
      </KbdGroup>
    );
  }

  // Single key
  return <Kbd className={kbdClassName}>{hotkey}</Kbd>;
};

const HotkeyTooltipWrapper = ({ hotkey, side, children }: HotkeyTooltipWrapperProps) => {
  if (!hotkey) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        align={'center'}
        className="bg-background border border-muted text-foreground/80 p-1"
        side={side}
        sideOffset={5}
      >
        {renderHotkey(hotkey)}
      </TooltipContent>
    </Tooltip>
  );
};

export default HotkeyTooltipWrapper;
