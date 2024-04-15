import React, { useEffect } from "react";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RenameAccountForm from "./RenameAccountForm";
import ChangeBioForm from "./ChangeBioForm";

type AccountManagementProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

enum AccountManagementTab {
  CHANGE_NAME = "Change_Name",
  CHANGE_PROFILE_PICTURE = "Change_Profile_Picture",
  CHANGE_BIO = "Change_Bio",
}

const AccountManagementTabs = [
  {
    key: AccountManagementTab.CHANGE_NAME,
    label: "Change Name",
  },
  {
    key: AccountManagementTab.CHANGE_PROFILE_PICTURE,
    label: "Change Profile Picture",
  },
  {
    key: AccountManagementTab.CHANGE_BIO,
    label: "Change Bio",
  },
];

const AccountManagement = ({ account, onSuccess }: AccountManagementProps) => {
  const [currentTab, setCurrentTab] = React.useState<AccountManagementTab>();

  const renderChangeNameTab = () => {
    return (
      <TabsContent value={AccountManagementTab.CHANGE_NAME}>
        <RenameAccountForm account={account} />
      </TabsContent>
    );
  };

  const renderChangeProfilePictureTab = () => {
    return (
      <TabsContent value={AccountManagementTab.CHANGE_PROFILE_PICTURE}>
        Make changes to your account here. PFP
      </TabsContent>
    );
  };

  const renderChangeBioTab = () => {
    return (
      <TabsContent value={AccountManagementTab.CHANGE_BIO}>
        <ChangeBioForm account={account} onSuccess={onSuccess} />
      </TabsContent>
    );
  };

  return (
    <div>
      <Tabs
        onValueChange={(v) => setCurrentTab(v as AccountManagementTab)}
        className="w-[500px]"
        defaultValue={AccountManagementTab.CHANGE_BIO}
      >
        <TabsList className="grid w-full grid-cols-3">
          {AccountManagementTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {renderChangeNameTab()}
        {renderChangeProfilePictureTab()}
        {renderChangeBioTab()}
      </Tabs>
    </div>
  );
};
export default AccountManagement;
