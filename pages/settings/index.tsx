import React, { useEffect, useState } from "react";
import HelpCard from "@/common/components/HelpCard";
import { Button } from "@/components/ui/button";
import {
  accountCommands,
  useAccountStore,
} from "@/stores/useAccountStore";
import { newPostCommands } from "@/stores/useDraftStore";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/router";
import { getNavigationCommands } from "@/getNavigationCommands";
import SwitchWalletButton from "@/common/components/SwitchWalletButton";
import { createClient } from "@/common/helpers/supabase/component";
import { usePostHog } from "posthog-js/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatShortcut } from "@/common/helpers/text";

type SimpleCommand = {
  name: string;
  shortcut: string;
};

export default function Settings() {
  const router = useRouter();
  const supabase = createClient();
  const posthog = usePostHog();

  const [user, setUser] = useState<User | null>(null);

  const { resetStore } = useAccountStore();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const onLogout = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      resetStore();
      setUser(null);
      await supabase.auth.signOut();
      posthog.reset();
    }

    router.push("/login");
  };

  const displayEmail = user?.email
    ? `${user?.email.slice(0, 5)}...@${user?.email.split("@")[1]}`
    : "";

  const renderInfoSection = () => {
    const allCommands = [
      { name: "Command Palette", shortcut: "cmd+k" },
      { name: "Feed: go to previous cast in list", shortcut: "k" },
      { name: "Feed: go to next cast in list", shortcut: "j" },
      { name: "Feed: Open thread view for cast", shortcut: "Enter or o" },
      { name: "Feed: Open embedded link in new tab", shortcut: "shift+o" },
      ...getNavigationCommands({ router }),
      ...newPostCommands,
      ...accountCommands,
    ];

    const commandsWithShortcuts: SimpleCommand[] = allCommands.filter(
      (command) => command.shortcut !== undefined
    );

    return (
      <div className="w-full max-w-xl mt-20 overflow-hidden">
        <div className="border-b border-border"></div>
        <Collapsible>
          <CollapsibleTrigger>
            <h3 className="mt-4 text-md font-semibold leading-7 text-foreground/80">
              Hotkeys / Keyboard Shortcuts (click to expand)
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-muted">
              <dl className="divide-y divide-muted">
                {commandsWithShortcuts.map((command) => (
                  <div
                    key={`command-${command.name}`}
                    className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4"
                  >
                    <dt className="text-sm text-foreground/60">
                      {command.name}
                    </dt>
                    {command.shortcut && (
                      <dd className="mt-1 text-sm leading-6 font-semibold text-foreground sm:col-span-1 sm:mt-0">
                        {formatShortcut(command.shortcut)}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <div className="ml-4 flex flex-col space-y-4">
      <div className="flex flex-row mt-4 pr-2">
        <span className="text-sm font-semibold text-foreground/80 mr-2">
          Email
        </span>
        <span className="text-sm font-semibold text-foreground/70 ">
          {displayEmail}
        </span>
      </div>
      <Button variant="default" onClick={() => onLogout()} className="w-20">
        Log out
      </Button>
      <div className="flex flex-row gap-4">
        <SwitchWalletButton />
      </div>
      <HelpCard />
      {renderInfoSection()}
    </div>
  );
}
