import React from "react";

export type CommandType = {
  name: string
  icon: React.ComponentType<{ className: string }>
  shortcut: string
  action: () => void
  aliases: string[]
  enableOnFormTags?: boolean
}
