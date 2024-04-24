import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserDataType } from "@farcaster/hub-web";
import { setUserDataInProtocol } from "@/common/helpers/farcaster";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { toast } from "sonner";
import ImgurUpload from "../ImgurUpload";
import { Input } from "@/components/ui/input";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

type ChangeProfilePictureFormProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

const ChangeProfilePictureForm = ({
  account,
  onSuccess,
}: ChangeProfilePictureFormProps) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<User>();
  const [newPfpUrl, setNewPfpUrl] = useState<string>();
  const [error, setError] = useState<string>();

  const canSubmit = !isPending && !!userInProtocol && !!newPfpUrl;

  useEffect(() => {
    const getUserInProtocol = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (
        await neynarClient.fetchBulkUsers(
          [Number(account.platformAccountId!)],
          { viewerFid: APP_FID! }
        )
      ).users[0];
      if (user) {
        setUserInProtocol(user);
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
      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.PFP,
        newPfpUrl
      );
      toast.success("Profile picture changed successfully", {
        duration: 5000,
        closeButton: true,
      });
      onSuccess?.();
    } catch (e) {
      console.error("ChangeProfilePicture error", e);
      setError(`Error setting profile picture -> ${e}`);
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <div className="flex flex-col gap-y-2 max-w-sm">
      {" "}
      <ImgurUpload onSuccess={setNewPfpUrl} />
      <Input
        size="sm"
        placeholder="https://i.imgur.com/..."
        onChange={(e) => setNewPfpUrl(e.target.value)}
      />
      <Button
        variant="default"
        type="submit"
        className="w-74"
        disabled={!canSubmit}
        onClick={changeProfilePicture}
      >
        {isPending && (
          <Cog6ToothIcon
            className="mr-2 h-5 w-5 animate-spin"
            aria-hidden="true"
          />
        )}
        <p>Update profile picture</p>
      </Button>
    </div>
  );

  return renderForm();
};

export default ChangeProfilePictureForm;
