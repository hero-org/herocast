import { NextRouter } from "next/router";
import { CommandType } from "./common/constants/commands";
import {
  ChartBarIcon,
  MagnifyingGlassIcon,
  RectangleGroupIcon,
} from "@heroicons/react/20/solid";
import { BellIcon } from "@heroicons/react/24/outline";
import { Bars3BottomLeftIcon } from "@heroicons/react/20/solid";
import { Cog6ToothIcon, UserPlusIcon } from "@heroicons/react/24/outline";

interface WithRouterProps {
  router: NextRouter;
}

export const getNavigationCommands = ({
  router,
}: WithRouterProps): CommandType[] => [
  {
    name: "Accounts",
    aliases: ["new account", "sign up"],
    icon: UserPlusIcon,
    shortcut: "meta+shift+a",
    action: () => router.push("/accounts"),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: "Switch to Feeds",
    aliases: ["scroll"],
    icon: Bars3BottomLeftIcon,
    shortcut: "shift+f",
    action: () => router.push("/feeds"),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: "Switch to Search",
    aliases: ["search"],
    icon: MagnifyingGlassIcon,
    shortcut: "/",
    action: () => router.push("/search"),
    options: {
      enableOnFormTags: false,
      preventDefault: true,
    },
  },
  {
    name: "Switch to Channels",
    aliases: ["channels"],
    icon: RectangleGroupIcon,
    shortcut: "shift+c",
    action: () => router.push("/channels"),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: "Notifications",
    aliases: ["notify", "alert", "mentions", "replies", "messages", "inbox"],
    icon: BellIcon,
    shortcut: "shift+n",
    action: () => router.push("/notifications"),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: "Settings",
    aliases: ["preferences", "options", "config"],
    icon: Cog6ToothIcon,
    shortcut: "cmd+shift+,",
    action: () => router.push("/settings"),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: "Analytics",
    aliases: ["stats", "insights", "data", "metrics", "report"],
    icon: ChartBarIcon,
    action: () => router.push("/analytics"),
  },
  {
    name: "Report a Bug",
    aliases: ["bug", "issue", "feedback", "suggestion", "complaint"],
    icon: BellIcon,
    action: () =>
      window.open(
        "https://github.com/hero-org/herocast/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=",
      ),
    options: {
      enableOnFormTags: false,
    },
  },
];
