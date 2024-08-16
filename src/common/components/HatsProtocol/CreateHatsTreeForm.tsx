import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { UseFormProps, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { toast } from "sonner";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { createInitialTree } from "@/common/helpers/hats";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { convertEnsNameToAddress, convertEnsNamesToAddresses } from "@/common/helpers/ens";
import EnsLookupLabel from "../EnsLookupLabel";
import { optimism } from "wagmi/chains";
import SwitchWalletButton from "../SwitchWalletButton";

enum CREATE_HATS_TREE_FORM_STEP {
  DEFAULT = "DEFAULT",
  PENDING_ONCHAIN_CONFIRMATION = "PENDING_ONCHAIN_CONFIRMATION",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

const isValidFormAddressInput = (input: string) => {
  return isAddress(input) || input.endsWith(".eth");
};

const CreateHatsTreeFormSchema = z.object({
  adminHatAddress: z.string().refine(isValidFormAddressInput, {
    message: "Invalid address",
  }),
  casterHatAddresses: z
    .array(
      z.object({
        address: z.string().refine(isValidFormAddressInput, {
          message: "Invalid address",
        }),
        id: z.string(),
      })
    )
    .nonempty(),
});

type CasterHatAddress = z.infer<typeof CreateHatsTreeFormSchema>["casterHatAddresses"][number];

const casterHatAddressesInitial: CasterHatAddress[] = [
  { id: "1", address: "" },
  { id: "2", address: "" },
];

type CreateHatsTreeFormProps = {
  onSuccess?: ({ casterHatId, adminHatId }: { casterHatId; adminHatId }) => void;
};

function useZodForm<TSchema extends z.ZodType>(
  props: Omit<UseFormProps<TSchema["_input"]>, "resolver"> & {
    schema: TSchema;
  }
) {
  const form = useForm<TSchema["_input"]>({
    ...props,
    resolver: zodResolver(props.schema, undefined, {
      // This makes it so we can use `.transform()`s on the schema without same transform getting applied again when it reaches the server
      rawValues: true,
    }),
  });

  return form;
}

const CreateHatsTreeForm = ({ onSuccess }: CreateHatsTreeFormProps) => {
  const [formState, setFormState] = useState<CREATE_HATS_TREE_FORM_STEP>(CREATE_HATS_TREE_FORM_STEP.DEFAULT);
  const walletClient = useWalletClient()?.data;
  const { chains, status, switchChain, switchChainAsync } = useSwitchChain();
  const [isPending, setIsPending] = useState(false);
  const [casterHatId, setCasterHatId] = useState<bigint>();
  const [adminHatId, setAdminHatId] = useState<bigint>();
  const { isConnected, address, chainId } = useAccount();
  const form = useZodForm({
    schema: CreateHatsTreeFormSchema,
    mode: "onChange",
    defaultValues: {
      adminHatAddress: address,
      casterHatAddresses: casterHatAddressesInitial,
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "casterHatAddresses",
    control: form.control,
    rules: {},
  });

  const onHatsTreeCreated = () => {
    toast.success("Created your Hats tree successfully", {
      duration: 7000,
    });
    onSuccess?.({ adminHatId, casterHatId });
  };

  useEffect(() => {
    if (formState === CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION) {
      setTimeout(() => {
        setFormState(CREATE_HATS_TREE_FORM_STEP.SUCCESS);
      }, 3000);
    }

    if (formState === CREATE_HATS_TREE_FORM_STEP.SUCCESS) {
      onHatsTreeCreated();
    }
  }, [formState]);

  const canSubmitForm = !isPending && !!form.formState.isDirty && !!form.formState.isValid && chainId;

  const createHatsTree = async (data) => {
    if (!walletClient) {
      return;
    }

    setIsPending(true);

    const adminHatAddress = await convertEnsNameToAddress(data.adminHatAddress);
    const casterHatAddresses = await convertEnsNamesToAddresses(data.casterHatAddresses.map((obj) => obj.address));

    data.adminHatAddress = adminHatAddress;
    data.casterHatAddresses = data.casterHatAddresses.map((obj, index) => {
      if (casterHatAddresses[index]) {
        return {
          ...obj,
          address: casterHatAddresses[index],
        };
      }
    });

    try {
      const { casterHat, adminHat } = await createInitialTree(
        address as `0x${string}`,
        data.adminHatAddress as `0x${string}`,
        data.casterHatAddresses.map((obj) => obj.address) as `0x${string}`[],
        walletClient
      );
      setCasterHatId(casterHat);
      setAdminHatId(adminHat);

      setFormState(CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION);
    } catch (e) {
      console.log("Error:", e);
      form.setError("adminHatAddress", {
        type: "manual",
        message: `Error creating hats tree -> ${e}`,
      });
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(createHatsTree)} className="space-y-4">
        <FormField
          control={form.control}
          name="adminHatAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin Address</FormLabel>
              <FormControl>
                <Input className="w-96" placeholder="0x..." {...field} />
              </FormControl>
              <EnsLookupLabel addressOrName={field.value} />
              <FormDescription className="w-96">
                This address will be able to add or remove people from the shared account.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-y-4">
          {fields.map((field, index) => {
            return (
              <div className="flex flex-row" key={field.id}>
                <FormField
                  name={`casterHatAddresses.${index}.address` as const}
                  render={({ field }) => (
                    <FormItem className="w-full" {...field}>
                      <FormLabel>Caster Address {index + 1}</FormLabel>
                      <FormControl>
                        <Input className="w-96" placeholder="0x..." {...field} />
                      </FormControl>
                      <EnsLookupLabel addressOrName={field.value} />
                      <FormDescription className="w-96">
                        This address will be able to read and write from the shared account.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {index > 0 && (
                  <Button variant="outline" onClick={() => remove(index)} className="ml-4 mt-7 w-36">
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
          <Button
            variant="outline"
            className="w-48"
            type="button"
            onClick={() =>
              append({
                id: String(fields.length + 1),
                address: "0x",
              })
            }
          >
            Add more casters
          </Button>
        </div>
        <div className="flex flex-col gap-y-4">
          {!isConnected && (
            <>
              <FormMessage className="text-red-500">Connect a wallet to create a Hats tree</FormMessage>
              <SwitchWalletButton />
            </>
          )}
          {isConnected && chainId !== optimism.id && (
            <Button
              type="button"
              variant="default"
              className="w-48"
              onClick={() => switchChain({ chainId: optimism.id })}
            >
              Switch to Optimism
            </Button>
          )}
          <Button disabled={!canSubmitForm} variant="default" type="submit" className="w-48">
            {isPending && <Cog6ToothIcon className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
            <p>Create Hats tree</p>
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderContent = () => {
    switch (formState) {
      case CREATE_HATS_TREE_FORM_STEP.DEFAULT:
        return renderForm();
      case CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION:
        return <p>Waiting for onchain confirmation...</p>;
      case CREATE_HATS_TREE_FORM_STEP.SUCCESS:
        return (
          <div>
            <p>Created your Hats tree successfully!</p>
            <Button
              variant="default"
              type="submit"
              className="w-74 mt-4"
              onClick={() => onSuccess?.({ casterHat, adminHat })}
            >
              <p>Continue</p>
            </Button>
          </div>
        );
      case CREATE_HATS_TREE_FORM_STEP.ERROR:
        return <p>Error creating Hats tree</p>;
      default:
        return null;
    }
  };

  return <div className="max-w-lg flex flex-col gap-y-4">{renderContent()}</div>;
};

export default CreateHatsTreeForm;
