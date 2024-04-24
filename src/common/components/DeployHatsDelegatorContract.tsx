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
import { ID_GATEWAY_ADDRESS, KEY_GATEWAY_ADDRESS, KEY_REGISTRY_ADDRESS, SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS, idRegistryABI } from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { ID_REGISTRY_ADDRESS } from "@farcaster/hub-web";
import { publicClient } from "@/common/helpers/rainbowkit";
import { useWaitForTransactionReceipt } from "wagmi";
import { z } from "zod";
import { Address, getAddress, hexToBigInt, parseEventLogs, toHex, zeroAddress } from "viem";
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
import {
  HatsModulesClient,
  Registry,
  checkAndEncodeArgs,
} from "@hatsprotocol/modules-sdk";
import { getCustomRegistry } from "../../lib/hats";
import { openWindow } from "@/common/helpers/navigation";
import { HatsModuleFactoryAbi } from "@/common/constants/contracts/HatsModuleFactory";
import { AddressSchema } from "@hatsprotocol/modules-sdk/dist/schemas";
import { optimismChainId } from "../helpers/env";

const HATS_FARCASTER_DELEGATOR_CONTRACT_ADDRESS: `0x${string}` = '0xa947334c33dadca4bcbb396395ecfd66601bb38c';
// const HATS_MODULE_FACTORY_ADDRESS: `0x${string}` = '0xfE661c01891172046feE16D3a57c3Cf456729efA';


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

const HatId = z.custom<string>((data) => {
  return String(data); //.startsWith("0x");
}, "Invalid Hat ID");

export type DeployHatsDelegatorContractFormValues = z.infer<
  typeof DeployHatsDelegatorContractFormSchema
>;

const DeployHatsDelegatorContractFormSchema = z.object({
  casterHatId: HatId,
  adminHatId: HatId,
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
    useState<`0x${string}`>("0x");
  const form = useForm<DeployHatsDelegatorContractFormValues>({
    resolver: zodResolver(DeployHatsDelegatorContractFormSchema),
    defaultValues: {
    },
  });
  const walletClient = useWalletClient({
    chainId: optimismChainId,
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

    // const casterHatId = hexToBigInt(form.getValues().casterHatId as `0x${string}`);
    // const adminHatId = hexToBigInt(form.getValues().adminHatId as `0x${string}`);
    const { casterHatId, adminHatId } = form.getValues();
    const immutableArgs = [BigInt(adminHatId), ID_GATEWAY_ADDRESS, ID_REGISTRY_ADDRESS, KEY_GATEWAY_ADDRESS, KEY_REGISTRY_ADDRESS, SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS];
    const mutableArgs = [zeroAddress];

    console.log("form.getValues()", form.getValues());
    console.log("immutableArgs", immutableArgs);


    const hatsModulesClient = new HatsModulesClient({
      publicClient,
      walletClient: walletClient.data!,
    });

    await hatsModulesClient.prepare(getCustomRegistry());
    const m = await hatsModulesClient.getModuleById(
      HATS_FARCASTER_DELEGATOR_CONTRACT_ADDRESS
    );
    checkAndEncodeArgs({
      module: m!,
      immutableArgs,
      mutableArgs,
    });

    try {
      const createInstanceResult = await hatsModulesClient.createNewInstance({
        account: address,
        moduleId: HATS_FARCASTER_DELEGATOR_CONTRACT_ADDRESS,
        hatId: BigInt(casterHatId as `0x${string}`),
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
                <Input placeholder="0x..." {...field} />
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
                <Input placeholder="0x..." {...field} />
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
