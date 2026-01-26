import { UserDataType } from '@farcaster/hub-web';
import { Cog6ToothIcon } from '@heroicons/react/20/solid';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { setUserDataInProtocol } from '@/common/helpers/farcaster';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { AccountObjectType } from '@/stores/useAccountStore';

type ChangeDisplayNameFormValues = z.infer<typeof ChangeDisplayNameFormSchema>;

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const validateMaxBytes32 = (value: string) => {
  return new TextEncoder().encode(value).length <= 32;
};

const ChangeDisplayNameFormSchema = z.object({
  displayName: z.string().refine(validateMaxBytes32, {
    message: 'Display name must not be longer than 32 bytes.',
  }),
});

type ChangeDisplayNameFormProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

const ChangeDisplayNameForm = ({ account, onSuccess }: ChangeDisplayNameFormProps) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<User>();

  const form = useForm<ChangeDisplayNameFormValues>({
    resolver: zodResolver(ChangeDisplayNameFormSchema),
    mode: 'onSubmit',
  });
  const canSubmitForm = !isPending && userInProtocol;

  useEffect(() => {
    const getUserInProtocol = async () => {
      try {
        const response = await fetch(`/api/users?fids=${account.platformAccountId}&viewer_fid=${APP_FID}`);
        if (!response.ok) {
          console.error('Failed to fetch user:', response.status);
          return;
        }
        const data = await response.json();
        const user = data.users?.[0];
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

  const changeDisplayName = async (data) => {
    if (!userInProtocol) return;

    const { displayName } = data;

    if (displayName === userInProtocol?.display_name) {
      form.setError('displayName', {
        type: 'manual',
        message: 'Please enter a new display name.',
      });
      return;
    }

    setIsPending(true);

    try {
      await setUserDataInProtocol(account.id, UserDataType.DISPLAY, displayName);
      toast.success('Display name changed successfully', {
        duration: 5000,
        closeButton: true,
      });
      onSuccess?.();
    } catch (e) {
      console.error('ChangeDisplayName error', e);
      form.setError('displayName', {
        type: 'manual',
        message: `Error setting displayName -> ${e}`,
      });
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(changeDisplayName)} className="space-y-4">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New display name</FormLabel>
              <FormControl>
                <Textarea
                  defaultValue={userInProtocol?.display_name}
                  placeholder="Your new display name..."
                  {...field}
                />
              </FormControl>
              <FormDescription>This will be your new public display name on Farcaster.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button disabled={!canSubmitForm} variant="default" type="submit" className="w-74">
          {isPending && <Cog6ToothIcon className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
          <p>Update display name</p>
        </Button>
      </form>
    </Form>
  );

  return <div className="flex flex-col gap-y-4">{renderForm()}</div>;
};

export default ChangeDisplayNameForm;
