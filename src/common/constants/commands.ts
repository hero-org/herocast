import React, { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import { HotkeysEvent, Options } from "react-hotkeys-hook/dist/types";



export type CommandType = {
  name: string
  shortcut?: string
  action: () => void
  aliases: string[]
  enabled?: boolean | ((keyboardEvent: KeyboardEvent, hotkeysEvent: HotkeysEvent) => boolean)
  icon?: ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>
  options?: Options,
  navigateTo?: string
}
