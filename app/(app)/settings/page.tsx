'use client';

import React, { useEffect, useState } from 'react';
import HelpCard from '@/common/components/HelpCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { accountCommands, useAccountStore } from '@/stores/useAccountStore';
import { newPostCommands } from '@/stores/useDraftStore';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getNavigationCommands } from '@/getNavigationCommands';
import SwitchWalletButton from '@/common/components/SwitchWalletButton';
import { createClient } from '@/common/helpers/supabase/component';
import { usePostHog } from 'posthog-js/react';
import { formatShortcut } from '@/common/helpers/text';
import { hotkeyDefinitions, hotkeyCategories } from '@/common/services/shortcuts/hotkeyDefinitions';
import { UserIcon, WalletIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/solid';
import { CommandLineIcon, PaintBrushIcon } from '@heroicons/react/24/outline';
import { ThemeToggle } from '@/common/components/ThemeToggle';

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

    router.push('/login');
  };

  const displayEmail = user?.email || '';

  const renderShortcutsDialog = () => {
    const allShortcuts: SimpleCommand[] = hotkeyDefinitions.map((def) => ({
      name: `${def.category}: ${def.name}`,
      shortcut: Array.isArray(def.keys) ? def.keys.join(' or ') : def.keys,
    }));

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CommandLineIcon className="h-4 w-4" />
            Keyboard Shortcuts
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Quick shortcuts to navigate and use herocast efficiently</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <dl className="divide-y divide-muted">
              {allShortcuts.map((command) => (
                <div key={`command-${command.name}`} className="px-2 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm text-foreground/70">{command.name}</dt>
                  {command.shortcut && (
                    <dd className="mt-1 text-sm leading-6 font-semibold text-foreground sm:col-span-1 sm:mt-0">
                      {formatShortcut(command.shortcut)}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-4">
      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Manage your account settings and authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
              </div>
              <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Log out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PaintBrushIcon className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Choose between light, dark or system theme</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Connections Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              Connections
            </CardTitle>
            <CardDescription>Manage your wallet connections and integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <SwitchWalletButton />
          </CardContent>
        </Card>

        {/* Support Section */}
        <HelpCard />

        {/* Quick Actions */}
        <div className="flex justify-end">{renderShortcutsDialog()}</div>
      </div>
    </div>
  );
}
