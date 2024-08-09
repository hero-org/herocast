import { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import { HotkeysEvent, Options } from "react-hotkeys-hook/dist/types";


export type CommandType = {
  name: string
  shortcut?: string
  shortcuts?: string[]
  action: () => void
  aliases?: string[]
  enabled?: boolean | (() => boolean)
  icon?: ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>
  iconUrl?: string,
  options?: Options,
  navigateTo?: string,
  data?: any,
  page?: string,
}
