import React from "react";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RenameAccountForm from "./RenameAccountForm";

type AccountManagementProps = {
  account: AccountObjectType;
};

enum AccountManagementTab {
  CHANGE_NAME = "Change_Name",
  CHANGE_PROFILE_PICTURE = "Change_Profile_Picture",
  CHANGE_BIO = "Change_Bio",
}

const AccountManagement = ({ account }: AccountManagementProps) => {
  const [currentTab, setCurrentTab] = React.useState<AccountManagementTab>(
    AccountManagementTab.CHANGE_NAME
  );

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
        Make changes to your account here. BIO
      </TabsContent>
    );
  };

  return (
    <div>
      <Tabs
        onValueChange={(v) => setCurrentTab(v as AccountManagementTab)}
        className="w-[500px]"
      >
        <TabsList className="grid w-full grid-cols-3">
          {Object.values(AccountManagementTab).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab.replaceAll("_", " ")}
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
