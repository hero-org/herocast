import React from "react";
import { HotkeysEvent, Options } from "react-hotkeys-hook/dist/types";



export type CommandType = {
  name: string
  shortcut?: string
  action: () => void
  aliases: string[]
  enabled?: boolean | ((keyboardEvent: KeyboardEvent, hotkeysEvent: HotkeysEvent) => boolean)
  icon?: React.ComponentType<{ className: string }>
  options?: Options,
  navigateTo?: string
}
