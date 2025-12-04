import React from 'react';
import { useDataStore } from '@/stores/useDataStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useProfile } from '@/hooks/queries/useProfile';
import ProfileInfoContent from '@/common/components/ProfileInfoContent';
import { Sidebar, SidebarContent } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const AuthorContextPanel = () => {
  const { selectedCast } = useDataStore();
  const currentAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const currentUserFid = currentAccount?.platformAccountId ? Number(currentAccount.platformAccountId) : undefined;

  // If cast selected, show cast author. Otherwise show current user
  const targetFid = selectedCast?.author?.fid || currentUserFid;

  const { data: profile, isLoading } = useProfile(
    { fid: targetFid },
    {
      viewerFid: currentUserFid,
      enabled: !!targetFid,
    }
  );

  const isShowingCurrentUser = !selectedCast && !!currentUserFid;
  const displayProfile = profile || selectedCast?.author;

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!targetFid) {
    return (
      <Sidebar side="right" collapsible="none" className="border-l border-sidebar-border/50 w-[280px] hidden lg:flex">
        <SidebarContent className="p-4">
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">Connect an account to see profile information</p>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar side="right" collapsible="none" className="border-l border-sidebar-border/50 w-[280px] hidden lg:flex">
      <SidebarContent className="p-4 overflow-y-auto">
        {isShowingCurrentUser && (
          <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">Your Profile</div>
        )}

        <div className="min-h-[180px] transition-opacity duration-150">
          {displayProfile ? (
            <ProfileInfoContent profile={displayProfile} showFollowButton={false} wideFormat />
          ) : isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="h-16 bg-muted rounded" />
            </div>
          ) : null}
        </div>

        {displayProfile?.verified_addresses?.eth_addresses &&
          displayProfile.verified_addresses.eth_addresses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sidebar-border/20">
              <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                Verified Addresses
              </div>
              <div className="space-y-1">
                {displayProfile.verified_addresses.eth_addresses.slice(0, 3).map((addr: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between group text-sm text-foreground/70 hover:text-foreground transition-colors"
                  >
                    <span className="font-mono text-xs">{truncateAddress(addr)}</span>
                    <button
                      onClick={() => copyToClipboard(addr)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                    >
                      {copiedAddress === addr ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        {displayProfile?.username && (
          <div className="mt-4 pt-4 border-t border-sidebar-border/20">
            <Link href={`/profile/${displayProfile.username}`} className="w-full">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <ExternalLink className="h-3 w-3 mr-2" />
                View full profile
              </Button>
            </Link>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default AuthorContextPanel;
