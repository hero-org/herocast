import React, { ReactNode, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export type FarcasterAccountSetupFormValues = z.infer<
  typeof FarcasterAccountSetupFormSchema
>;

const FarcasterAccountSetupFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 1 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  displayName: z.string().min(5, {
    message: "Display name must be at least 5 characters",
  }),
  bio: z.string().max(160).min(4),
});

const CreateFarcasterAccountForm = ({
    onSuccess,
}: {
  onSuccess: (data: FarcasterAccountSetupFormValues) => void;
}) => {
  const form = useForm<FarcasterAccountSetupFormValues>({
    resolver: zodResolver(FarcasterAccountSetupFormSchema),
    defaultValues: {},
    mode: "onChange",
  });

  const onFormSubmit = (data: FarcasterAccountSetupFormValues) => {
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name. It can be your real name or a
                pseudonym. You can only change this once every 30 days.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us a little bit about yourself"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                You can <span>@mention</span> other users and organizations to
                link to them.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Create account</Button>
      </form>
    </Form>
  );
};

export default CreateFarcasterAccountForm;
