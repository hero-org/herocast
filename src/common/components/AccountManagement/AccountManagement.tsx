import React, { useEffect } from "react";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RenameAccountForm from "./RenameAccountForm";
import ChangeBioForm from "./ChangeBioForm";
import ChangeDisplayNameForm from "./ChangeDisplayNameForm";
import ImgurUpload from "../ImgurUpload";
import ChangeProfilePictureForm from "./ChangeProfilePictureForm";

type AccountManagementProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

enum AccountManagementTab {
  NAME = "NAME",
  PROFILE_PICTURE = "PROFILE_PICTURE",
  BIO = "BIO",
  DISPLAY_NAME = "DISPLAY_NAME",
}

const AccountManagementTabs = [
  {
    key: AccountManagementTab.DISPLAY_NAME,
    label: "Display Name",
  },
  {
    key: AccountManagementTab.PROFILE_PICTURE,
    label: "Profile Picture",
  },
  {
    key: AccountManagementTab.BIO,
    label: "Bio",
  },
  {
    key: AccountManagementTab.NAME,
    label: "Name",
  },
];

const AccountManagement = ({ account, onSuccess }: AccountManagementProps) => {
  const renderChangeNameTab = () => {
    return (
      <TabsContent value={AccountManagementTab.NAME}>
        <RenameAccountForm account={account} />
      </TabsContent>
    );
  };

  const renderChangeProfilePictureTab = () => (
    <TabsContent value={AccountManagementTab.PROFILE_PICTURE}>
      <ChangeProfilePictureForm account={account} onSuccess={onSuccess} />
    </TabsContent>
  );

  const renderChangeBioTab = () => (
    <TabsContent value={AccountManagementTab.BIO}>
      <ChangeBioForm account={account} onSuccess={onSuccess} />
    </TabsContent>
  );

  const renderChangeDisplayNameTab = () => (
    <TabsContent value={AccountManagementTab.DISPLAY_NAME}>
      <ChangeDisplayNameForm account={account} onSuccess={onSuccess} />
    </TabsContent>
  );
    
  return (
    <div>
      <Tabs className="w-[500px]" defaultValue={AccountManagementTab.DISPLAY_NAME}>
        <TabsList className="grid w-full grid-cols-4 gap-x-2">
          {AccountManagementTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {renderChangeDisplayNameTab()}
        {renderChangeNameTab()}
        {renderChangeProfilePictureTab()}
        {renderChangeBioTab()}
      </Tabs>
    </div>
  );
};
export default AccountManagement;
