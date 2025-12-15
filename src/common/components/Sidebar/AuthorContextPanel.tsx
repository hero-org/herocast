import React from 'react';
import { useDataStore } from '@/stores/useDataStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useProfile } from '@/hooks/queries/useProfile';
import { useBulkProfiles } from '@/hooks/queries/useBulkProfiles';
import ProfileInfoContent from '@/common/components/ProfileInfoContent';
import { Sidebar, SidebarContent } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Check, Twitter, Github } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  getAppByFid,
  VERIFIED_ACCOUNT_PLATFORMS,
  type VerifiedAccountPlatform,
} from '@/common/constants/farcasterApps';

type ExtendedProfile = {
  verified_accounts?: Array<{ platform: VerifiedAccountPlatform; username: string }>;
  auth_addresses?: Array<{
    address: string;
    app: { object: string; fid: number; username?: string };
  }>;
};

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
  const extendedProfile = displayProfile as (typeof displayProfile & ExtendedProfile) | undefined;

  const unknownAppFids = useMemo(() => {
    if (!extendedProfile?.auth_addresses) return [];
    return extendedProfile.auth_addresses.map((authAddr) => authAddr.app.fid).filter((fid) => !getAppByFid(fid));
  }, [extendedProfile?.auth_addresses]);

  const { data: appProfiles = [] } = useBulkProfiles(unknownAppFids, {
    viewerFid: currentUserFid || 0,
    enabled: unknownAppFids.length > 0,
  });

  const getAppProfile = (fid: number) => {
    return appProfiles.find((p) => p.fid === fid);
  };

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
      <Sidebar side="right" collapsible="none" className="border-l border-sidebar-border/50 w-full hidden lg:flex">
        <SidebarContent className="p-4">
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">Connect an account to see profile information</p>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar side="right" collapsible="none" className="border-l border-sidebar-border/50 w-full hidden lg:flex">
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

        {extendedProfile?.verified_accounts && extendedProfile.verified_accounts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-sidebar-border/20">
            <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
              Connected Accounts
            </div>
            <div className="space-y-1.5">
              {extendedProfile.verified_accounts.map(
                (account: { platform: VerifiedAccountPlatform; username: string }, i: number) => {
                  const platformInfo = VERIFIED_ACCOUNT_PLATFORMS[account.platform];
                  const url = platformInfo?.urlPrefix ? `${platformInfo.urlPrefix}${account.username}` : null;

                  const renderIcon = () => {
                    switch (account.platform) {
                      case 'x':
                        return <Twitter className="h-3.5 w-3.5" />;
                      case 'github':
                        return <Github className="h-3.5 w-3.5" />;
                      case 'discord':
                        return (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                          </svg>
                        );
                      default:
                        return <ExternalLink className="h-3.5 w-3.5" />;
                    }
                  };

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {renderIcon()}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                          {account.username}
                        </a>
                      ) : (
                        <span className="truncate">{account.username}</span>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {extendedProfile?.auth_addresses && extendedProfile.auth_addresses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-sidebar-border/20">
            <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
              Authorized Apps
            </div>
            <div className="space-y-1.5">
              {extendedProfile.auth_addresses
                .slice(0, 5)
                .map((authAddr: { address: string; app: { fid: number; username?: string } }, i: number) => {
                  const appInfo = getAppByFid(authAddr.app.fid);
                  const appProfile = !appInfo ? getAppProfile(authAddr.app.fid) : null;
                  const appName =
                    appInfo?.name ||
                    appProfile?.display_name ||
                    appProfile?.username ||
                    authAddr.app.username ||
                    `FID ${authAddr.app.fid}`;

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between group text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                          {appName.slice(0, 2).toUpperCase()}
                        </div>
                        {appInfo?.url ? (
                          <a
                            href={appInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline truncate"
                          >
                            {appName}
                          </a>
                        ) : (
                          <span className="truncate">{appName}</span>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(authAddr.address)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded shrink-0"
                        title={`Copy address: ${authAddr.address}`}
                      >
                        {copiedAddress === authAddr.address ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
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
