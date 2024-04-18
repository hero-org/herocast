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
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { toast } from "sonner";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";

enum CREATE_HATS_TREE_FORM_STEP {
  DEFAULT = "DEFAULT",
  PENDING_ONCHAIN_CONFIRMATION = "PENDING_ONCHAIN_CONFIRMATION",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

const CreateHatsTreeFormSchema = z.object({
  adminHatAddress: z.string(),
  //   .refine(isAddress, {
  //     message: "Invalid address",
  //   }),
  casterHatAddresses: z.array(
    z.object({
      address: z.string(),
      // .refine(isAddress, {
      //   message: "Invalid address",
      // }),
      id: z.string(),
    })
  ),
  // .nonempty(),
});

// type CreateHatsTreeFormValues = z.infer<typeof CreateHatsTreeFormSchema>;

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
  //   const [casterHatAddresses, setCasterHatAddresses] = useState<
  //     CasterHatAddress[]
  //   >(() => casterHatAddressesInitial);

  const form = useZodForm({
    schema: CreateHatsTreeFormSchema,
    // resolver: zodResolver(CreateHatsTreeFormSchema),
    mode: "onChange",
    defaultValues: { casterHatAddresses: casterHatAddressesInitial },
  });

  const { fields, append, remove } = useFieldArray({
    name: "casterHatAddresses",
    control: form.control,
  });

  const onHatsTreeCreated = () => {
    toast.success("Created your Hats tree successfully", {
      duration: 5000,
      closeButton: true,
    });
    onSuccess?.();
  };

  useEffect(() => {
    if (formState === CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION) {
      // wait for 3 seconds then switch to success
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

    setIsPending(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setFormState(CREATE_HATS_TREE_FORM_STEP.PENDING_ONCHAIN_CONFIRMATION);
    } catch (e) {
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
                <Input className="w-3/4" placeholder="0x..." {...field} />
              </FormControl>
              <FormDescription>
                This address will have the ability to manage the tree.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-y-4">
          {fields.map((field, index) => {
            const errorForField =
              form.formState.errors?.casterHatAddresses?.[index]?.address;
            return (
              <div className="flex flex-row" key={field.id}>
                <FormField
                  name={`casterHatAddresses.${field.id}.address` as const}
                  render={({ field }) => (
                    <FormItem className="w-full" {...field}>
                      <FormLabel>Caster Hat Address {index + 1}</FormLabel>
                      <FormControl>
                        <Input placeholder="0x..." {...field} />
                      </FormControl>
                      <FormDescription>
                        {errorForField?.message ?? <>&nbsp;</>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {index === 0 ? (
                  <Button
                    variant="outline"
                    className="ml-4 mt-7 w-36"
                    onClick={() =>
                      append({
                        id: String(fields.length + 1),
                        address: "0x",
                      })
                    }
                  >
                    Add more
                  </Button>
                ) : (
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
        </div>
        <Button
          disabled={!canSubmitForm}
          variant="default"
          type="submit"
          className="w-74"
        >
          {isPending && (
            <Cog6ToothIcon
              className="mr-2 h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          )}
          <p>Create permissions onchain</p>
        </Button>
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
