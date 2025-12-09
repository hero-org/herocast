import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronDown, ExternalLink, Lock, MessageSquare } from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';
import Image from 'next/image';

interface DMsOnboardingProps {
  onComplete: () => void;
}

export const DMsOnboarding: React.FC<DMsOnboardingProps> = ({ onComplete }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
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

  const handleNext = () => {
    if (currentStep === 3) {
      handleSaveApiKey();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
      setError(null);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const isNextDisabled = () => {
    if (currentStep === 3) {
      return isLoading || !apiKey.trim() || !apiKey.startsWith('wc_secret_');
    }
    return false;
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open the link below and sign in to your Farcaster account. This only works on desktop browsers.
            </p>
            <Button
              variant="outline"
              onClick={() => window.open('https://farcaster.xyz/~/developers/api-keys', '_blank')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Farcaster API Keys
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a new API key and give it a name like &quot;Herocast&quot;. This helps you identify which app is
              using the key.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setIsScreenshotOpen(!isScreenshotOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <span>{isScreenshotOpen ? 'Hide' : 'Show'} screenshot</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isScreenshotOpen ? 'rotate-180' : ''}`} />
              </button>
              {isScreenshotOpen && (
                <div className="mt-4">
                  <div className="rounded-lg overflow-hidden border w-fit mx-auto">
                    <Image
                      src="/images/dms/farcaster-create-api-key.png"
                      alt="Farcaster app showing Create API key dialog"
                      width={400}
                      height={225}
                      className="h-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Create a new API key with a descriptive name
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Copy your newly generated API key and paste it in the field below. The key should start with
              &quot;wc_secret_&quot;.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setIsScreenshotOpen(!isScreenshotOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <span>{isScreenshotOpen ? 'Hide' : 'Show'} screenshot</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isScreenshotOpen ? 'rotate-180' : ''}`} />
              </button>
              {isScreenshotOpen && (
                <div className="mt-4">
                  <div className="rounded-lg overflow-hidden border w-fit mx-auto">
                    <Image
                      src="/images/dms/farcaster-save-api-key.png"
                      alt="Farcaster app showing Save API key dialog with the generated key"
                      width={400}
                      height={225}
                      className="h-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Copy the API key that starts with &quot;wc_secret_&quot;
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Open Farcaster API Keys';
      case 2:
        return 'Create a new key';
      case 3:
        return 'Paste your key';
      default:
        return '';
    }
  };

  return (
    <>
      {/* Empty State */}
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto text-center px-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Direct Messages</h2>
            <p className="text-muted-foreground">Connect your Farcaster API key to access your direct messages</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} size="lg">
            Set up Direct Messages
          </Button>
        </div>
      </div>

      {/* Setup Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Set up Direct Messages</DialogTitle>
            {/* Step indicators */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-muted-foreground">Step {currentStep} of 3</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      step === currentStep ? 'bg-primary' : step < currentStep ? 'bg-primary/40' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step Content */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{getStepTitle()}</h3>
              {getStepContent()}
            </div>

            {/* API Key Input - only on final step */}
            {currentStep === 3 && (
              <div className="space-y-3 pt-2 border-t">
                <Label htmlFor="api-key" className="text-sm font-medium">
                  Farcaster API Key
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="wc_secret_..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError(null);
                  }}
                  className="font-mono"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
                />
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Your API key is encrypted and stored securely</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={isNextDisabled()}>
              {currentStep === 3 ? (isLoading ? 'Enabling...' : 'Enable Direct Messages') : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
