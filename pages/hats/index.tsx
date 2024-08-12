import React, { ReactNode, useState } from "react";
import { Separator } from "@/components/ui/separator";
import StepSequence from "@/common/components/Steps/StepSequence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "wagmi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TransferAccountToHatsDelegator from "@/common/components/HatsProtocol/TransferAccountToHatsDelegator";
import CreateHatsTreeForm from "@/common/components/HatsProtocol/CreateHatsTreeForm";
import { NeynarAPIClient, convertToV2User } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import BigOptionSelector from "@/common/components/BigOptionSelector";
import isEmpty from "lodash.isempty";
import SwitchWalletButton from "@/common/components/SwitchWalletButton";
import { Loading } from "@/common/components/Loading";
import ClickToCopyText from "@/common/components/ClickToCopyText";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import SharedAccountOwnershipSetup, {
    OwnershipSetupSteps,
} from "@/common/components/HatsProtocol/SharedAccountOwnershipSetup";
import { useHotkeys } from "react-hotkeys-hook";

enum HatsSignupNav {
    select_account = "SELECT_ACCOUNT",
    decide_hats_protocol_setup = "DECIDE_HATS_PROTOCOL_SETUP",
    create_hats_tree = "CREATE_HATS_TREE",
    account_ownership = "ACCOUNT_OWNERSHIP",
    transfer_ownership = "TRANSFER_OWNERSHIP",
    invite = "INVITE",
}

const hatsSignupSteps = [
    {
        title: "Select account",
        idx: 0,
        keys: [HatsSignupNav.select_account],
    },
    {
        title: "Onchain Permissions",
        idx: 1,
        keys: [HatsSignupNav.decide_hats_protocol_setup, HatsSignupNav.create_hats_tree],
    },
    {
        title: "Account ownership",
        idx: 2,
        keys: [HatsSignupNav.account_ownership],
    },
    {
        title: "Transfer ownership",
        idx: 3,
        keys: [HatsSignupNav.transfer_ownership],
    },
    {
        title: "Invite others",
        idx: 4,
        keys: [HatsSignupNav.invite],
    },
];

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

export default function HatsProtocolPage() {
    const [step, setStep] = useState<HatsSignupNav>(HatsSignupNav.select_account);
    const [accountToTransfer, setAccountToTransfer] = useState<User>();
    const [delegatorContractAddress, setDelegatorContractAddress] = useState<`0x${string}` | null>();
    const [adminHatId, setAdminHatId] = useState<bigint>();
    const [casterHatId, setCasterHatId] = useState<bigint>();
    const [sharedAccountOwnershipDefaultStep, setSharedAccountOwnershipDefaultStep] = useState<OwnershipSetupSteps>(
        OwnershipSetupSteps.unknown
    );
    const [infoMessage, setInfoMessage] = useState<string | null>();
    const { address, isConnected } = useAccount();
    const [userInput, setUserInput] = useState<string>("");
    const [isLoadingAccount, setIsLoadingAccount] = useState(false);
    const shareWithOthersText = `Join my shared Farcaster account with delegator contract
  address: ${delegatorContractAddress} and FID ${accountToTransfer?.fid}`;

    const getUserByFid = async (fid: number): Promise<User | undefined> => {
        const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
        const viewerFid = Number(APP_FID);
        const res = await neynarClient.fetchBulkUsers([fid], {
            viewerFid,
        });
        return res?.users?.[0];
    };

    const fetchUser = async () => {
        if (!userInput) return;

        setIsLoadingAccount(true);
        try {
            const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

            const viewerFid = Number(APP_FID);
            let fid: number | undefined;
            const isNumeric = /^-?\d+$/.test(userInput);
            if (isNumeric) {
                fid = Number(userInput);
                setAccountToTransfer(await getUserByFid(fid));
            } else {
                const userSearchTerm = userInput.replace("@", "").trim();
                let user: User | undefined;
                try {
                    const userByUsername = await neynarClient.lookupUserByUsername(userSearchTerm, viewerFid);
                    if (userByUsername?.result?.user) {
                        user = convertToV2User(userByUsername.result.user);
                    }
                } catch (error) {
                    /* neynar throws if lookupUserByUsername fails, but it's okay */
                }

                if (!user) {
                    const res = await neynarClient.searchUser(userSearchTerm, viewerFid);
                    user = res?.result?.users?.[0];
                }
                setAccountToTransfer(user);
            }
        } catch (error) {
            console.error(error);
            setInfoMessage("User not found, please try again");
        } finally {
            setIsLoadingAccount(false);
        }
    };

    useHotkeys("meta+enter", fetchUser, [fetchUser], {
        enableOnFormTags: true,
    });

    const getStepContent = (title: string, description: ReactNode | string, children?: ReactNode) => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">{title}</h3>
                {typeof description === "string" ? (
                    <p className="text-sm text-muted-foreground">{description}</p>
                ) : (
                    description
                )}
            </div>
            <Separator />
            {children}
        </div>
    );

    const renderUserInputForm = () => (
        <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
                <Input
                    variantSize="lg"
                    className="w-72"
                    placeholder="herocast"
                    value={userInput}
                    onChange={(e) => {
                        if (accountToTransfer) setAccountToTransfer(undefined);
                        if (infoMessage) setInfoMessage(null);
                        setUserInput(e.target.value);
                    }}
                />
                <Button
                    size="lg"
                    className="w-1/3"
                    variant={accountToTransfer ? "outline" : "default"}
                    onClick={fetchUser}
                >
                    Search
                </Button>
            </div>
            <Label>Enter the username or FID of the account you want to share with others.</Label>
            {accountToTransfer && renderAccountToTransferPreview()}
            {isLoadingAccount && <Loading />}
        </div>
    );

    const renderAccountToTransferPreview = () =>
        accountToTransfer && (
            <div className="mb-4 space-x-4 grid grid-cols-2 lg:grid-cols-3">
                <div className="col-span-1 lg:col-span-2">
                    <Avatar className="h-14 w-14">
                        <AvatarImage alt="User avatar" src={accountToTransfer.pfp_url} />
                        <AvatarFallback>{accountToTransfer.username || accountToTransfer.fid}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                        <h2 className="text-xl font-bold text-foreground">{accountToTransfer?.display_name}</h2>
                        <span className="text-sm text-foreground/80">
                            @{accountToTransfer?.username} · fid: {accountToTransfer?.fid}
                        </span>
                    </div>
                </div>
            </div>
        );

    const renderSelectAccount = () => {
        return getStepContent(
            "Select account",
            "You need to connect your wallet to select a Farcaster account to share",
            <div className="flex flex-col space-y-8 w-1/2">
                <SwitchWalletButton />
                {renderUserInputForm()}
                {infoMessage && <p className="text-sm text-foreground/70">{infoMessage}</p>}
                <Button
                    className="w-1/3"
                    variant="default"
                    disabled={!isConnected || !accountToTransfer}
                    onClick={() => setStep(HatsSignupNav.decide_hats_protocol_setup)}
                >
                    Continue
                </Button>
            </div>
        );
    };

    const renderInvite = () => {
        return (
            <div className="space-y-6">
                <div className="flex flex-col">
                    <p className="text-lg text-semibold">Successfully created your shared Farcaster account 🥳</p>
                    <p className="text-muted-foreground">All users with the Caster Hat in their wallet can now join!</p>
                    <div className="mt-4 flex justify-between">
                        <div className="flex flex-row space-x-2">
                            <ClickToCopyText text={shareWithOthersText} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center space-x-4">
                        <p className="w-min text-foreground py-2 px-3 bg-muted rounded-lg">{shareWithOthersText}</p>
                    </div>
                    <Label>Share this to invite other users to join your shared account</Label>
                </div>
            </div>
        );
    };

    const renderStep = (step: string) => {
        switch (step) {
            case HatsSignupNav.select_account:
                return renderSelectAccount();
            case HatsSignupNav.decide_hats_protocol_setup:
                return getStepContent(
                    "Onchain Permissions",
                    "Setup your Hats tree and deploy a delegator contract",
                    <div>
                        {accountToTransfer && renderAccountToTransferPreview()}
                        <BigOptionSelector
                            disabled={isEmpty(accountToTransfer)}
                            options={[
                                {
                                    title: "I have not used Hats Protocol before",
                                    description: "herocast will guide you through the setup",
                                    buttonText: "Get started",
                                    onClick: () => setStep(HatsSignupNav.create_hats_tree),
                                },
                                {
                                    title: "My organization has a Hats tree",
                                    description: "herocast helps you import your permissions",
                                    buttonText: "I have a Hats tree",
                                    onClick: () => setStep(HatsSignupNav.account_ownership),
                                },
                            ]}
                        />
                    </div>
                );
            case HatsSignupNav.create_hats_tree:
                return getStepContent(
                    "Setup onchain permissions for your shared account",
                    <a
                        href="https://docs.hatsprotocol.xyz/"
                        className="flex text-sm text-muted-foreground hover:underline"
                    >
                        Learn more about Hats Protocol <ArrowTopRightOnSquareIcon className="ml-1 mt-px h-4 w-4" />
                    </a>,
                    <div>
                        {accountToTransfer && renderAccountToTransferPreview()}
                        <CreateHatsTreeForm
                            onSuccess={({ casterHatId, adminHatId }) => {
                                setAdminHatId(adminHatId);
                                setCasterHatId(casterHatId);
                                setSharedAccountOwnershipDefaultStep(OwnershipSetupSteps.existing_tree);
                                setStep(HatsSignupNav.account_ownership);
                            }}
                        />
                    </div>
                );
            case HatsSignupNav.account_ownership:
                return getStepContent(
                    "Account ownership",
                    "Decide where the Farcaster account will be owned and managed",
                    <div>
                        {accountToTransfer && renderAccountToTransferPreview()}
                        <SharedAccountOwnershipSetup
                            defaultStep={sharedAccountOwnershipDefaultStep}
                            onSuccess={() => setStep(HatsSignupNav.transfer_ownership)}
                            delegatorContractAddress={delegatorContractAddress}
                            setDelegatorContractAddress={setDelegatorContractAddress}
                            adminHatId={adminHatId}
                            casterHatId={casterHatId}
                        />
                    </div>
                );
            case HatsSignupNav.transfer_ownership:
                return getStepContent(
                    "Transfer ownership",
                    "Send your Farcaster account to the delegator contract",
                    <div>
                        {accountToTransfer && renderAccountToTransferPreview()}
                        <TransferAccountToHatsDelegator
                            user={accountToTransfer!}
                            onSuccess={() => setStep(HatsSignupNav.invite)}
                            toAddress={delegatorContractAddress!}
                        />
                    </div>
                );
            case HatsSignupNav.invite:
                return getStepContent("Invite others", "Let other users join your shared account", renderInvite());
            default:
                return null;
        }
    };

    return (
        <div className="w-full">
            <div className="space-y-6 p-4 pb-16 block">
                <StepSequence
                    title="Create a shared Farcaster account"
                    description="powered by Hats Protocol 🧢"
                    step={step}
                    setStep={setStep}
                    navItems={hatsSignupSteps}
                    renderStep={renderStep}
                />
            </div>
        </div>
    );
}
