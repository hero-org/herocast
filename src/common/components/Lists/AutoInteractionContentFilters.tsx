import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

interface AutoInteractionContentFiltersProps {
  feedSource?: 'specific_users' | 'following';
  requiredUrls?: string[];
  requiredKeywords?: string[];
  onFeedSourceChange: (source: 'specific_users' | 'following') => void;
  onRequiredUrlsChange: (urls: string[]) => void;
  onRequiredKeywordsChange: (keywords: string[]) => void;
  hideSpecificUsers?: boolean; // Hide this option when creating new list
}

export function AutoInteractionContentFilters({
  feedSource = 'specific_users',
  requiredUrls = [],
  requiredKeywords = [],
  onFeedSourceChange,
  onRequiredUrlsChange,
  onRequiredKeywordsChange,
  hideSpecificUsers = false,
}: AutoInteractionContentFiltersProps) {
  const [newUrl, setNewUrl] = React.useState('');
  const [newKeyword, setNewKeyword] = React.useState('');

  const handleAddUrl = () => {
    if (newUrl && !requiredUrls.includes(newUrl)) {
      onRequiredUrlsChange([...requiredUrls, newUrl]);
      setNewUrl('');
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword && !requiredKeywords.includes(newKeyword)) {
      onRequiredKeywordsChange([...requiredKeywords, newKeyword]);
      setNewKeyword('');
    }
  };

  return (
    <div className="space-y-6">
      {!hideSpecificUsers && (
        <div className="space-y-2">
          <Label>Feed Source</Label>
          <RadioGroup
            value={feedSource}
            onValueChange={(value) => onFeedSourceChange(value as 'specific_users' | 'following')}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific_users" id="specific_users" />
              <Label htmlFor="specific_users" className="font-normal cursor-pointer">
                Specific users
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="following" id="following" />
              <Label htmlFor="following" className="font-normal cursor-pointer">
                Everyone I follow
              </Label>
            </div>
          </RadioGroup>
          <p className="text-sm text-muted-foreground">
            {feedSource === 'specific_users'
              ? 'Monitor casts from specific accounts only'
              : 'Monitor casts from all accounts you follow'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Required URLs (optional)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., vibes.engineering"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
          />
          <Button size="sm" onClick={handleAddUrl} disabled={!newUrl}>
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        {requiredUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {requiredUrls.map((url) => (
              <Badge key={url} variant="secondary">
                {url}
                <button
                  onClick={() => onRequiredUrlsChange(requiredUrls.filter((u) => u !== url))}
                  className="ml-1 hover:text-destructive"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Only interact with casts containing these URLs</p>
      </div>

      <div className="space-y-2">
        <Label>Required Keywords (optional)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., launch, announcement"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
          />
          <Button size="sm" onClick={handleAddKeyword} disabled={!newKeyword}>
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        {requiredKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {requiredKeywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
                <button
                  onClick={() => onRequiredKeywordsChange(requiredKeywords.filter((k) => k !== keyword))}
                  className="ml-1 hover:text-destructive"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Only interact with casts containing these keywords</p>
      </div>
    </div>
  );
}
