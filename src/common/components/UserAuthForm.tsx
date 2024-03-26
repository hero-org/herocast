import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "./Loading";
import { SignInButton } from "@farcaster/auth-kit";
import { useState } from "react";
import { createClient } from "../helpers/supabase/component";
import { useRouter } from "next/router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { usePostHog } from "posthog-js/react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { hydrate } from "@/stores/useAccountStore";

export type UserAuthFormValues = z.infer<typeof UserAuthFormSchema>;

const UserAuthFormSchema = z.object({
  email: z
    .string()
    .min(2, {
      message: "Username must be at least 1 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  password: z.string().min(6, {
    message: "Password must be at least 8 characters.",
  }),
});

export function UserAuthForm({ className }: { className: string }) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const supabase = createClient();
  const router = useRouter();
  const posthog = usePostHog();

  const form = useForm<UserAuthFormValues>({
    resolver: zodResolver(UserAuthFormSchema),
    mode: "onSubmit",
  });

  const setupUser = async (userId: string) => {
    setIsLoading(true);
    if (userId) {
      posthog.identify(userId);
    }
    await hydrate();
    setIsLoading(false);
    router.push("/feed");
  };
  
  async function logIn() {
    if (!(await form.trigger())) return;
    
    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("logIn", data, error);
    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error(error);
    }
    setIsLoading(false);
    router.push("/");
  }

  async function signUp() {
    if (!(await form.trigger())) return;
    
    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signUp({ email, password });

    console.log("signUp", data, error);
    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error(error);
    }
    setIsLoading(false);
    router.push("/welcome");
  }
  
  return (
    <div className={cn("grid gap-6", className)}>
      <Form {...form}>
        <form>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="hellno@yesyes.xyz"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Label className="sr-only" htmlFor="email">
                Email
              </Label>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="************"
                        disabled={isLoading}
                        autoComplete="current-password"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Label className="sr-only" htmlFor="password">
                Password
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="text-white"
              disabled={isLoading}
              onClick={() => logIn()}
            >
              {isLoading ? <Loading /> : "Sign In with Email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-white"
              disabled={isLoading}
              onClick={() => signUp()}
            >
              {isLoading ? <Loading /> : "Signup"}
            </Button>
          </div>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-gray-900 px-2 text-muted">or continue with</span>
        </div>
      </div>
      <div className="flex justify-center">
        <SignInButton />
      </div>
    </div>
  );
}
