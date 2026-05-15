import { UserDataType } from '@farcaster/hub-web';
import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { setUserDataInProtocol } from '@/common/helpers/farcaster';
import type { FarcasterUser } from '@/common/types/farcaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProvider } from '@/lib/farcaster/providers';
import type { AccountObjectType } from '@/stores/useAccountStore';
import CloudinaryUpload from '../CloudinaryUpload';

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

type ChangeProfilePictureFormProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

const ChangeProfilePictureForm = ({ account, onSuccess }: ChangeProfilePictureFormProps) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<FarcasterUser>();
  const [newPfpUrl, setNewPfpUrl] = useState<string>();
  const [error, setError] = useState<string>();

  const canSubmit = !isPending && !!userInProtocol && !!newPfpUrl;

  useEffect(() => {
    const getUserInProtocol = async () => {
      try {
        const users = await getProvider().getBulkUsers({
          fids: [Number(account.platformAccountId)],
          viewerFid: APP_FID,
        });
        const user = users[0];
        if (user) {
          setUserInProtocol(user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    if (account.platformAccountId) {
      getUserInProtocol();
    }
  }, [account.platformAccountId]);

  const changeProfilePicture = async () => {
    if (!newPfpUrl) return;
    if (error) setError(undefined);

    setIsPending(true);
    try {
      await setUserDataInProtocol(account.id, UserDataType.PFP, newPfpUrl);
      toast.success('Profile picture changed successfully', {
        duration: 5000,
        closeButton: true,
      });
      onSuccess?.();
    } catch (e) {
      console.error('ChangeProfilePicture error', e);
      setError(`Error setting profile picture -> ${e}`);
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <div className="flex flex-col gap-y-2 max-w-sm">
      {' '}
      <CloudinaryUpload onSuccess={setNewPfpUrl} />
      <Input
        variantSize="sm"
        placeholder="https://res.cloudinary.com/..."
        onChange={(e) => setNewPfpUrl(e.target.value)}
      />
      <Button variant="default" type="submit" className="w-74" disabled={!canSubmit} onClick={changeProfilePicture}>
        {isPending && <Settings className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
        <p>Update profile picture</p>
      </Button>
    </div>
  );

  return renderForm();
};

export default ChangeProfilePictureForm;
