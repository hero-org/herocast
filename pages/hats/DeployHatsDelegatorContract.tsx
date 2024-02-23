import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useSignTypedData } from "wagmi";
import { Input } from "@/components/ui/input";
import { idRegistryABI } from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { ID_REGISTRY_ADDRESS } from "@farcaster/hub-web";
import { publicClient } from "@/common/helpers/rainbowkit";
import { useWaitForTransactionReceipt } from "wagmi";
import { z } from "zod";
import { isAddress } from "viem";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

enum DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS {
  "CONNECT_WALLET",
  "EXECUTE_ONCHAIN",
  "PENDING_ONCHAIN_CONFIRMATION",
  "CONFIRMED",
  "ERROR",
}

type SignupStepType = {
  state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS;
  title: string;
  description: string;
  idx: number;
};

const HatsProtocolSignupSteps: SignupStepType[] = [
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.EXECUTE_ONCHAIN,
    title: "Connected",
    description:
      "Enter Hats tree details to deploy your delegator contract onchain",
    idx: 1,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.PENDING_ONCHAIN_CONFIRMATION,
    title: "",
    description: "Pending onchain deployment",
    idx: 2,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONFIRMED,
    title: "",
    description: "You have successfully deployed the contract",
    idx: 3,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.ERROR,
    title: "Error",
    description: "Something went wrong",
    idx: 4,
  },
];

const Address = z.custom<string>(
  (data) => isAddress(String(data)),
  "Invalid Address"
);

export type DeployHatsDelegatorContractFormValues = z.infer<
  typeof DeployHatsDelegatorContractFormSchema
>;

const DeployHatsDelegatorContractFormSchema = z.object({
  hatsTreeAddress: z.object({ address: Address }),
});

const DeployHatsDelegatorContract = ({
  onSuccess,
}: {
  onSuccess: () => null;
}) => {
  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[0]
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>("0x");
  const form = useForm<DeployHatsDelegatorContractFormValues>({
    resolver: zodResolver(DeployHatsDelegatorContractFormSchema),
  });
  const { signTypedDataAsync } = useSignTypedData();

  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult) {
      setState(HatsProtocolSignupSteps[5]);
    }
  }, [onchainTransactionHash, transactionResult]);

  const onExecuteTransfer = async () => {};

  const getButtonLabel = () => {
    switch (state.state) {
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONNECT_WALLET:
        return "Connect wallet";
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.EXECUTE_ONCHAIN:
        return "Deploy contract";
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.PENDING_ONCHAIN_CONFIRMATION:
        return (
          <p className="flex">
            <Cog6ToothIcon
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          </p>
        );
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONFIRMED:
        return "Done";
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.ERROR:
        return "Error";
    }
  };

  useEffect(() => {
    if (
      state.state === DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONNECT_WALLET &&
      address
    ) {
      setState(HatsProtocolSignupSteps[1]);
    }
  }, [address]);

  const renderForm = () => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onExecuteTransfer)}
        className="space-y-8"
      >
        <FormField
          control={form.control}
          name="hatsTreeAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin Hat ID</FormLabel>
              <FormControl>
                <Input placeholder="0x1234..." {...field} />
              </FormControl>
              <FormDescription></FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hatsTreeAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caster Hat ID</FormLabel>
              <FormControl>
                <Input placeholder="0x1234..." {...field} />
              </FormControl>
              <FormDescription></FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant="default" onClick={() => onSuccess()}>
          Deploy contract
        </Button>
        {/* <Button variant="default" type="submit">
          Deploy contract
        </Button> */}
      </form>
    </Form>
  );

  const onClick = () => {
    switch (state.state) {
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.EXECUTE_ONCHAIN:
        onExecuteTransfer();
        break;
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.PENDING_ONCHAIN_CONFIRMATION:
        break;
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONFIRMED:
        break;
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.ERROR:
        setState(HatsProtocolSignupSteps[0]);
        break;
    }
  };

  const getCardContent = () => {
    switch (state.state) {
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.EXECUTE_ONCHAIN:
        return (
          <div className="flex flex-col">
            <div className="w-2/3">{renderForm()}</div>
          </div>
        );
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONFIRMED:
        return (
          <div className="flex flex-col">
            <div className="w-2/3">
              <p className="">Delegator contract address:</p>
              <p className="p-2 rounded-md bg-gray-200 text-gray-700 text-wrap break-all">
                {address}
              </p>
            </div>
          </div>
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="flex w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Deploy your Hats Protocol Delegator contract
          </CardTitle>
          <CardDescription className="text-lg">
            {state.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-lg">
          {getCardContent()}
          {errorMessage && (
            <div className="flex flex-start items-center mt-2">
              <p className="text-wrap break-all	text-sm text-red-500">
                Error: {errorMessage}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </div>
  );
};

export default DeployHatsDelegatorContract;
