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
import { useAccount, useSignTypedData, useWalletClient } from "wagmi";
import { Input } from "@/components/ui/input";
import { idRegistryABI } from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { ID_REGISTRY_ADDRESS } from "@farcaster/hub-web";
import { publicClient } from "@/common/helpers/rainbowkit";
import { useWaitForTransactionReceipt } from "wagmi";
import { z } from "zod";
import { isAddress, parseEventLogs } from "viem";
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
import { HatsModulesClient, Registry } from "@hatsprotocol/modules-sdk";
import { HATS_FARCASTER_DELEGATOR_CONTRACT_ADDRESS } from "./const";
import { optimism } from "wagmi/chains";
import { getCustomRegistry } from "./utils";
import { openWindow } from "@/common/helpers/navigation";
import { HatsModuleFactoryAbi } from "@/common/constants/contracts/HatsModuleFactory";
import isEmpty from "lodash.isempty";
import { on } from "events";

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
    idx: 0,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.PENDING_ONCHAIN_CONFIRMATION,
    title: "",
    description: "Pending onchain deployment",
    idx: 1,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.CONFIRMED,
    title: "",
    description: "You have successfully deployed the contract onchain ✅",
    idx: 2,
  },
  {
    state: DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.ERROR,
    title: "Error",
    description: "Something went wrong",
    idx: 3,
  },
];

const Address = z.custom<string>((data) => {
  return isAddress(String(data));
}, "Invalid Address");

export type DeployHatsDelegatorContractFormValues = z.infer<
  typeof DeployHatsDelegatorContractFormSchema
>;

const toNumber = z.number().or(z.string()).pipe(z.coerce.number());

// todo: those are not bigints, they are hex numbers, e.g.
// 0x0000003a00010001000100000000000000000000000000000000000000000000
const DeployHatsDelegatorContractFormSchema = z.object({
  casterHatId: z.bigint().or(toNumber).pipe(z.coerce.bigint()),
  adminHatId: z.bigint().or(toNumber).pipe(z.coerce.bigint()),
});

const DeployHatsDelegatorContract = ({
  onSuccess,
  delegatorContractAddress,
  setDelegatorContractAddress,
}: {
  onSuccess: () => null;
  delegatorContractAddress: `0x${string}`;
  setDelegatorContractAddress: (address: `0x${string}`) => void;
}) => {
  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[0]
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>(
      "0x87abb82438d868f5c5b2654842a1a469cda9f6c8f4c50b1b0e0f88770c1aa47e"
    );
  const form = useForm<DeployHatsDelegatorContractFormValues>({
    resolver: zodResolver(DeployHatsDelegatorContractFormSchema),
    defaultValues: {
      adminHatId: 23n,
      casterHatId: 58n,
    },
  });
  const walletClient = useWalletClient({
    chainId: optimism.id,
  });
  const { address } = useAccount();

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult?.data) {
      setState(HatsProtocolSignupSteps[2]);

      const logs = parseEventLogs({
        abi: HatsModuleFactoryAbi,
        logs: transactionResult?.data?.logs,
      });
      const instance = logs[0].args.instance;
      setDelegatorContractAddress(instance);
      console.log("transactionResult", transactionResult.data);
    }
  }, [onchainTransactionHash, transactionResult]);

  const onExecuteDeploy = async () => {
    if (!address) return;

    // switch walletCLient to chainId
    const { casterHatId, adminHatId } = form.getValues();
    const immutableArgs = [BigInt(adminHatId), BigInt(casterHatId)];
    const mutableArgs = [];

    const hatsModulesClient = new HatsModulesClient({
      publicClient,
      walletClient: walletClient.data!,
    });
    try {
      await hatsModulesClient.prepare(getCustomRegistry());

      console.log("immutableArgs", immutableArgs, "mutableArgs", mutableArgs);
      const createInstanceResult = await hatsModulesClient.createNewInstance({
        account: address,
        moduleId: HATS_FARCASTER_DELEGATOR_CONTRACT_ADDRESS,
        hatId: BigInt(casterHatId),
        immutableArgs,
        mutableArgs,
      });
      console.log("createInstanceResult", createInstanceResult);
      setOnchainTransactionHash(createInstanceResult.transactionHash);
    } catch (e) {
      console.error(e);
      setErrorMessage(e.message);
      setState(HatsProtocolSignupSteps[3]);
    }
  };

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
      <form onSubmit={form.handleSubmit(onExecuteDeploy)} className="space-y-8">
        <FormField
          control={form.control}
          name="adminHatId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin Hat ID</FormLabel>
              <FormControl>
                <Input placeholder="23" {...field} />
              </FormControl>
              <FormDescription></FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="casterHatId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caster Hat ID</FormLabel>
              <FormControl>
                <Input placeholder="42" {...field} />
              </FormControl>
              <FormDescription></FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant="default" type="submit">
          Deploy contract
        </Button>
      </form>
    </Form>
  );

  const onClick = () => {
    switch (state.state) {
      case DEPLOY_HATS_DELEGATOR_CONTRACT_STEPS.EXECUTE_ONCHAIN:
        onExecuteDeploy();
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
              {delegatorContractAddress ? (
                <p className="text-foreground/70">
                  Your deployed contract is live at
                  <p
                    className="cursor-pointer text-foreground/90"
                    onClick={() =>
                      openWindow(
                        `https://optimistic.etherscan.io/address/${delegatorContractAddress}#code`
                      )
                    }
                  >
                    {delegatorContractAddress}
                  </p>
                </p>
              ) : (
                <p className="text-red-500">
                  No logs found for the transaction hash, something is off
                </p>
              )}
              <Button
                variant="outline"
                className="mt-4"
                onClick={() =>
                  openWindow(
                    `https://optimistic.etherscan.io/tx/${onchainTransactionHash}`
                  )
                }
              >
                See transaction on Etherscan ↗️
              </Button>
              <Button className="mt-4" onClick={() => onSuccess()}>
                Continue
              </Button>
            </div>
          </div>
        );
      default:
        return <></>;
    }
  };

  const onResetError = () => {
    setErrorMessage("");
    setState(HatsProtocolSignupSteps[0]);
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
            <div className="flex flex-col flex-start mt-2">
              <p className="text-wrap break-all	text-sm text-red-500">
                {errorMessage}
              </p>
              <Button
                className="w-1/2 mt-4"
                variant="outline"
                onClick={() => onResetError()}
              >
                Retry
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </div>
  );
};

export default DeployHatsDelegatorContract;
