import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { UseFormProps, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { AccountObjectType } from "@/stores/useAccountStore";
import {
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
} from "@heroicons/react/20/solid";
import { toast } from "sonner";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { getEnsAddress, getEnsName } from "@wagmi/core";
import { mainnetConfig } from "@/common/helpers/rainbowkit";
import { normalize } from "viem/ens";
import {
  treeIdToTopHatId,
  hatIdDecimalToHex,
  hatIdHexToDecimal,
} from "@hatsprotocol/sdk-v1-core";
import { createInitialTree } from "@/common/helpers/hats";
import { useAccount } from "wagmi";

enum CREATE_HATS_TREE_FORM_STEP {
  DEFAULT = "DEFAULT",
  PENDING_ONCHAIN_CONFIRMATION = "PENDING_ONCHAIN_CONFIRMATION",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

const getAddressFromEnsName = async (name) => {
  const ensAddress = await getEnsAddress(mainnetConfig, {
    name: normalize(name),
  });
  return ensAddress;
};

const getEnsNameForAddress = async (address) => {
  const ensName = await getEnsName(mainnetConfig, {
    address,
  });
  return ensName;
};

const EnsLookupLabel = ({ addressOrName }: { addressOrName: string }) => {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  /* 
  useEffect(() => {
    if (addressOrName && addressOrName.endsWith(".eth")) {
      getAddressFromEnsName(addressOrName).then((ensAddress) => {
        setAddress(ensAddress);
      });
      return;
    }

    if (isAddress(addressOrName)) {
      getEnsNameForAddress(addressOrName).then((ensName) => {
        setEnsName(ensName);
      });
    }

    return () => {
      setEnsName(null);
      setAddress(null);
    };
  }, [addressOrName]);
  */

  if (!addressOrName) return null;

  return (
    (ensName || address) && (
      <a
        href={`https://etherscan.io/address/${addressOrName}`}
        target="_blank"
        rel="noreferrer"
        className="flex text-sm hover:underline"
      >
        {ensName || address}{" "}
        <ArrowTopRightOnSquareIcon className="ml-1 mt-0.5 h-4 w-4" />
      </a>
    )
  );
};

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

type CasterHatAddress = z.infer<
  typeof CreateHatsTreeFormSchema
>["casterHatAddresses"][number];

const casterHatAddressesInitial: CasterHatAddress[] = [
  { id: "1", address: "0x" },
  { id: "2", address: "0x" },
];

type CreateHatsTreeFormProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
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

const CreateHatsTreeForm = ({
  account,
  onSuccess,
}: CreateHatsTreeFormProps) => {
  const [formState, setFormState] = useState<CREATE_HATS_TREE_FORM_STEP>(
    CREATE_HATS_TREE_FORM_STEP.DEFAULT
  );
  const [isPending, setIsPending] = useState(false);
  const [casterHat, setCasterHat] = useState<bigint | undefined>(undefined);
  const { address } = useAccount();

  const form = useZodForm({
    schema: CreateHatsTreeFormSchema,
    mode: "onChange",
    defaultValues: { casterHatAddresses: casterHatAddressesInitial },
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
    onSuccess?.();
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

  const canSubmitForm =
    !isPending && !!form.formState.isDirty && !!form.formState.isValid;

  const createHatsTree = async (data) => {
    console.log("createHatsTree", data);

    // if addresses are ENS names, resolve them to addresses with:
    // if (address.endsWith(".eth")) {
    //    getAddressFromEnsName(address)
    // }
    setIsPending(true);

    try {
      const casterHat = await createInitialTree(
        address as `0x${string}`,
        data.adminHatAddress as `0x${string}`,
        data.casterHatAddresses.map((obj) => obj.address) as `0x${string}`[]
      );
      setCasterHat(casterHat);

      setFormState(CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION);
    } catch (e) {
      console.log("Error:", e);
      form.setError("adminHatAddress", {
        type: "manual",
        message: `Error creating hats tree -> ${e}`,
      });
    } finally {
      setIsPending(false);
      form.reset(data);
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
                This address will be able to change all permissions and has the
                broadest authority.
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
                      <FormLabel>Caster Hat {index + 1}</FormLabel>
                      <FormControl>
                        <Input
                          className="w-96"
                          placeholder="0x..."
                          {...field}
                        />
                      </FormControl>
                      <EnsLookupLabel addressOrName={field.value} />
                      <FormDescription className="w-96">
                        This address will be able to read and write from the
                        shared account.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {index > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => remove(index)}
                    className="ml-4 mt-7 w-36"
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
          <Button
            variant="outline"
            className="w-48"
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
        <Button
          disabled={!canSubmitForm}
          variant="default"
          type="submit"
          className="w-48"
        >
          {isPending && (
            <Cog6ToothIcon
              className="mr-2 h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          )}
          <p>Create Hats tree</p>
        </Button>
      </form>
    </Form>
  );

  const renderContent = () => {
    switch (formState) {
      case CREATE_HATS_TREE_FORM_STEP.DEFAULT:
        return renderForm();
      case CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION:
        // can insert pending information about what is happening here
        return <p>Waiting for onchain confirmation...</p>;
      case CREATE_HATS_TREE_FORM_STEP.SUCCESS:
        return (
          <div>
            <p>Created your Hats tree successfully!</p>
            <Button
              variant="default"
              type="submit"
              className="w-74 mt-4"
              onClick={() => onSuccess?.()}
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
  return (
    <div className="max-w-lg flex flex-col gap-y-4">{renderContent()}</div>
  );
};

export default CreateHatsTreeForm;
