import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Key, MessageSquare, Shield } from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';
import Image from 'next/image';

interface DMsOnboardingProps {
  onComplete: () => void;
}

export const DMsOnboarding: React.FC<DMsOnboardingProps> = ({ onComplete }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(false);
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Farcaster API key');
      return;
    }

    if (!apiKey.startsWith('wc_secret_')) {
      setError('API key must start with "wc_secret_"');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save the API key to Supabase (encrypted)
      const response = await fetch('/api/accounts/farcaster-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccount?.id,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }

      // Update the account in memory with the API key
      if (selectedAccount) {
        const { updateAccountProperty } = useAccountStore.getState();
        updateAccountProperty(selectedAccount.id, 'farcasterApiKey', apiKey.trim());
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key. Please try again.');
      console.error('Error saving API key:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-blue-500" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold">Enable Direct Messages</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Connect your Farcaster API key to read your direct messages in Herocast
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 px-8 pb-8">
          {/* Allowlist notice */}
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <Key className="h-5 w-5 text-amber-600" />
            <AlertDescription className="text-sm leading-relaxed">
              <strong className="font-semibold">Important:</strong> Direct Messages API access is restricted. Your
              Farcaster account must be allowlisted by the Farcaster team to use DMs in third-party apps like Herocast.
            </AlertDescription>
          </Alert>

          {/* Security note */}
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <Shield className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-sm leading-relaxed">
              Your API key is encrypted and stored securely. It&apos;s never shared or exposed.
            </AlertDescription>
          </Alert>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">How to get your API key:</h3>
              <button
                onClick={() => setShowImages(!showImages)}
                className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
              >
                {showImages ? 'Hide' : 'Show'} screenshots
              </button>
            </div>
            <ol className="space-y-3">
              <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-medium text-blue-500 bg-blue-50 dark:bg-blue-950/50 rounded-full w-7 h-7 flex items-center justify-center">
                  1
                </span>
                <span className="text-muted-foreground pt-0.5">
                  Click &quot;Get API Key (Desktop)&quot; button below to access the API keys page
                </span>
              </li>
              <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-medium text-blue-500 bg-blue-50 dark:bg-blue-950/50 rounded-full w-7 h-7 flex items-center justify-center">
                  2
                </span>
                <span className="text-muted-foreground pt-0.5">
                  Sign in and navigate to your API keys (desktop only)
                </span>
              </li>
              <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-medium text-blue-500 bg-blue-50 dark:bg-blue-950/50 rounded-full w-7 h-7 flex items-center justify-center">
                  3
                </span>
                <span className="text-muted-foreground pt-0.5">Create a new API key for Herocast</span>
              </li>
              <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-medium text-blue-500 bg-blue-50 dark:bg-blue-950/50 rounded-full w-7 h-7 flex items-center justify-center">
                  4
                </span>
                <span className="text-muted-foreground pt-0.5">Copy the generated key and paste it below</span>
              </li>
              <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-medium text-amber-500 bg-amber-50 dark:bg-amber-950/50 rounded-full w-7 h-7 flex items-center justify-center">
                  5
                </span>
                <span className="text-muted-foreground pt-0.5">
                  Request DM API access by clicking &quot;Request Allowlist&quot; below
                </span>
              </li>
            </ol>

            {/* Screenshot guides */}
            {showImages && (
              <div className="space-y-6 mt-6 p-6 bg-muted/30 rounded-lg">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Step 4: Create new API key</p>
                  <div className="rounded-lg overflow-hidden border border-muted shadow-sm">
                    <Image
                      src="/images/dms/farcaster-create-api-key.png"
                      alt="Farcaster app showing Create API key dialog"
                      width={1600}
                      height={900}
                      className="w-full h-auto"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This dialog appears when you tap &quot;Create new API key&quot;
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium">Step 5: Save your API key</p>
                  <div className="rounded-lg overflow-hidden border border-muted shadow-sm">
                    <Image
                      src="/images/dms/farcaster-save-api-key.png"
                      alt="Farcaster app showing Save API key dialog with the generated key"
                      width={1600}
                      height={900}
                      className="w-full h-auto"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copy the API key that starts with &quot;wc_secret_&quot; and paste it above
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* API Key input */}
          <div className="space-y-3">
            <Label htmlFor="api-key" className="text-base font-medium">
              Farcaster API Key
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="api-key"
                  type="password"
                  placeholder="wc_secret_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10 h-12 text-base font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={handleSaveApiKey}
              disabled={isLoading || !apiKey.trim()}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isLoading ? 'Saving...' : 'Enable Direct Messages'}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => window.open('https://farcaster.xyz/~/developers/api-keys', '_blank')}
                className="h-12 text-base"
                size="lg"
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                Get API Key (Desktop)
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  const message = encodeURIComponent(
                    'Hey! Would love to get my API key on the allowlist to use it in herocast'
                  );
                  window.open(`https://farcaster.xyz/~/inbox/create/834?text=${message}`, '_blank');
                }}
                className="h-12 text-base"
                size="lg"
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                Request Allowlist
              </Button>
            </div>
          </div>

          {/* Skip option */}
          <div className="text-center pt-2">
            <button
              onClick={onComplete}
              className="text-base text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Skip for now
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
