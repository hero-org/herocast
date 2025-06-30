import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { KeyboardShortcut, KeyboardShortcutGroup } from "@/components/ui/keyboard-shortcut"
import { cn } from "@/lib/utils"

interface KeyboardShortcutTooltipProps {
  children: React.ReactNode
  keys: string | string[]
  description?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delayDuration?: number
  className?: string
  contentClassName?: string
  shortcutSize?: "sm" | "md" | "lg"
  showOnFocus?: boolean
}

export function KeyboardShortcutTooltip({
  children,
  keys,
  description,
  side = "top",
  align = "center",
  delayDuration = 400,
  className,
  contentClassName,
  shortcutSize = "sm",
  showOnFocus = true,
}: KeyboardShortcutTooltipProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn(
            "flex items-center gap-2",
            contentClassName
          )}
          onPointerDownOutside={(e) => {
            // Prevent tooltip from closing when clicking on it
            if (!showOnFocus) {
              e.preventDefault()
            }
          }}
        >
          {description && (
            <span className="text-xs">{description}</span>
          )}
          <KeyboardShortcut keys={keys} size={shortcutSize} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface KeyboardShortcutTooltipGroupProps {
  children: React.ReactNode
  shortcuts: Array<{
    keys: string | string[]
    description?: string
  }>
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delayDuration?: number
  className?: string
  contentClassName?: string
  shortcutSize?: "sm" | "md" | "lg"
  showOnFocus?: boolean
}

export function KeyboardShortcutTooltipGroup({
  children,
  shortcuts,
  side = "top",
  align = "center",
  delayDuration = 400,
  className,
  contentClassName,
  shortcutSize = "sm",
  showOnFocus = true,
}: KeyboardShortcutTooltipGroupProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn(
            "flex flex-col gap-1.5 p-2",
            contentClassName
          )}
          onPointerDownOutside={(e) => {
            if (!showOnFocus) {
              e.preventDefault()
            }
          }}
        >
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center gap-2">
              <KeyboardShortcut keys={shortcut.keys} size={shortcutSize} />
              {shortcut.description && (
                <span className="text-xs text-muted-foreground">
                  {shortcut.description}
                </span>
              )}
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Example usage:
// <KeyboardShortcutTooltip keys="meta+k" description="Open command menu">
//   <Button>Search</Button>
// </KeyboardShortcutTooltip>
//
// <KeyboardShortcutTooltipGroup
//   shortcuts={[
//     { keys: "meta+k", description: "Open search" },
//     { keys: "meta+shift+p", description: "Command palette" },
//     { keys: "esc", description: "Close" }
//   ]}
// >
//   <Button>Keyboard Shortcuts</Button>
// </KeyboardShortcutTooltipGroup>