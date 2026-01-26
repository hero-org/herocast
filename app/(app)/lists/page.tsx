'use client';

import { BoltIcon, MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Head from 'next/head';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AutoListsView } from '@/common/components/Lists/AutoListsView';
import { SearchListsView } from '@/common/components/Lists/SearchListsView';
import { UserListsView } from '@/common/components/Lists/UserListsView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useListStore } from '@/stores/useListStore';

interface ListTypeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  onClick: () => void;
  isLoading: boolean;
}

function ListTypeCard({ icon, title, description, count, onClick, isLoading }: ListTypeCardProps) {
  if (isLoading) {
    return <Skeleton className="h-[200px]" />;
  }

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-center justify-between">
          {icon}
          <span className="text-2xl font-bold">{count}</span>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="ghost" className="w-full">
          Manage →
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ListsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lists, isHydrated, hydrate } = useListStore();
  const [activeTab, setActiveTab] = useState('all');

  const searchLists = lists.filter((l) => l.type === 'search');
  const fidLists = lists.filter((l) => l.type === 'fids');
  const autoLists = lists.filter((l) => l.type === 'auto_interaction');

  // Initialize from query params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && typeof tab === 'string' && ['all', 'search', 'users', 'auto'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Hydrate store on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/lists?tab=${value}`);
  };

  return (
    <>
      <Head>
        <title>Lists & Automations - herocast</title>
      </Head>

      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Lists & Automations</h1>
          <p className="text-muted-foreground mt-2">
            Organize your Farcaster experience with saved searches, user lists, and automated interactions
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Lists {isHydrated && `(${lists.length})`}</TabsTrigger>
            <TabsTrigger value="search">Searches {isHydrated && `(${searchLists.length})`}</TabsTrigger>
            <TabsTrigger value="users">User Lists {isHydrated && `(${fidLists.length})`}</TabsTrigger>
            <TabsTrigger value="auto">Automations {isHydrated && `(${autoLists.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <ListTypeCard
                icon={<MagnifyingGlassIcon className="h-8 w-8 text-blue-500" />}
                title="Saved Searches"
                description="Monitor keywords and get daily email alerts"
                count={searchLists.length}
                onClick={() => handleTabChange('search')}
                isLoading={!isHydrated}
              />
              <ListTypeCard
                icon={<UserGroupIcon className="h-8 w-8 text-green-500" />}
                title="User Lists"
                description="Group and follow specific users"
                count={fidLists.length}
                onClick={() => handleTabChange('users')}
                isLoading={!isHydrated}
              />
              <ListTypeCard
                icon={<BoltIcon className="h-8 w-8 text-purple-500" />}
                title="Auto-Interactions"
                description="Automated likes and recasts between accounts"
                count={autoLists.length}
                onClick={() => handleTabChange('auto')}
                isLoading={!isHydrated}
              />
            </div>

            {isHydrated && lists.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t created any lists yet. Get started by choosing a list type above.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="search">
            <SearchListsView lists={searchLists} isLoading={!isHydrated} />
          </TabsContent>

          <TabsContent value="users">
            <UserListsView lists={fidLists} isLoading={!isHydrated} />
          </TabsContent>

          <TabsContent value="auto">
            <AutoListsView lists={autoLists} isLoading={!isHydrated} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
