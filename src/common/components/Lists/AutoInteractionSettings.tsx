import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useState } from 'react';
import { ProfileSearchDropdown } from '@/common/components/ProfileSearchDropdown';
import type { Account } from '@/common/types/database.types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAccountStore } from '@/stores/useAccountStore';
import { AutoInteractionContentFilters } from './AutoInteractionContentFilters';

interface AutoInteractionSettingsProps {
  sourceAccountId?: string;
  actionType?: 'like' | 'recast' | 'both';
  onlyTopCasts?: boolean;
  requireMentions?: string[];
  feedSource?: 'specific_users' | 'following';
  requiredUrls?: string[];
  requiredKeywords?: string[];
  onSourceAccountChange: (accountId: string) => void;
  onActionTypeChange: (type: 'like' | 'recast' | 'both') => void;
  onOnlyTopCastsChange: (value: boolean) => void;
  onRequireMentionsChange: (fids: string[]) => void;
  onFeedSourceChange?: (source: 'specific_users' | 'following') => void;
  onRequiredUrlsChange?: (urls: string[]) => void;
  onRequiredKeywordsChange?: (keywords: string[]) => void;
  hideSpecificUsers?: boolean;
}

export function AutoInteractionSettings({
  sourceAccountId,
  actionType = 'both',
  onlyTopCasts = true,
  requireMentions = [],
  feedSource = 'specific_users',
  requiredUrls = [],
  requiredKeywords = [],
  onSourceAccountChange,
  onActionTypeChange,
  onOnlyTopCastsChange,
  onRequireMentionsChange,
  onFeedSourceChange = () => {},
  onRequiredUrlsChange = () => {},
  onRequiredKeywordsChange = () => {},
  hideSpecificUsers = false,
}: AutoInteractionSettingsProps) {
  const { accounts } = useAccountStore();
  const [selectedMentionProfiles, setSelectedMentionProfiles] = useState<User[]>([]);

  const handleAddMentionRequirement = (profile: User) => {
    if (!requireMentions.includes(profile.fid.toString())) {
      onRequireMentionsChange([...requireMentions, profile.fid.toString()]);
      setSelectedMentionProfiles([...selectedMentionProfiles, profile]);
    }
  };

  const handleRemoveMentionRequirement = (fid: string) => {
    onRequireMentionsChange(requireMentions.filter((f) => f !== fid));
    setSelectedMentionProfiles(selectedMentionProfiles.filter((p) => p.fid.toString() !== fid));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="source-account">Acting Account</Label>
        <Select value={sourceAccountId} onValueChange={onSourceAccountChange}>
          <SelectTrigger id="source-account">
            <SelectValue placeholder="Select an account to perform actions" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account: Account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name || `Account ${account.id.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          This account will automatically like or recast posts from the target accounts
        </p>
      </div>

      <div className="space-y-2">
        <Label>Action Type</Label>
        <RadioGroup
          value={actionType}
          onValueChange={(value) => onActionTypeChange(value as 'like' | 'recast' | 'both')}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="like" id="like" />
            <Label htmlFor="like" className="font-normal cursor-pointer">
              Like only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="recast" id="recast" />
            <Label htmlFor="recast" className="font-normal cursor-pointer">
              Recast only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both" className="font-normal cursor-pointer">
              Like and recast
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="only-top-casts">Only interact with top-level casts</Label>
          <Switch id="only-top-casts" checked={onlyTopCasts} onCheckedChange={onOnlyTopCastsChange} />
        </div>
        <p className="text-sm text-muted-foreground">When enabled, replies will be ignored</p>
      </div>

      <div className="space-y-2">
        <Label>Require mentions (optional)</Label>
        <ProfileSearchDropdown
          defaultProfiles={[]}
          selectedProfile={undefined}
          setSelectedProfile={handleAddMentionRequirement}
          placeholder="Add accounts that must be mentioned"
        />
        {selectedMentionProfiles.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-muted-foreground">Only interact if these accounts are mentioned:</p>
            <div className="flex flex-wrap gap-2">
              {selectedMentionProfiles.map((profile) => (
                <div
                  key={profile.fid}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-secondary rounded-md"
                >
                  <span>@{profile.username}</span>
                  <button
                    onClick={() => handleRemoveMentionRequirement(profile.fid.toString())}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AutoInteractionContentFilters
        feedSource={feedSource}
        requiredUrls={requiredUrls}
        requiredKeywords={requiredKeywords}
        onFeedSourceChange={onFeedSourceChange}
        onRequiredUrlsChange={onRequiredUrlsChange}
        onRequiredKeywordsChange={onRequiredKeywordsChange}
        hideSpecificUsers={hideSpecificUsers}
      />
    </div>
  );
}
