import React, { useState } from "react";
import {
  CheckCircleIcon,
  NewspaperIcon,
  PlusCircleIcon,
} from "@heroicons/react/20/solid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import {
  useNewPostStore,
} from "@/stores/useNewPostStore";
import { JoinedHerocastPostDraft } from "@/common/constants/postDrafts";

const WelcomeSuccessPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { accounts, addAccount } = useAccountStore();
  const router = useRouter();
  const { addNewPostDraft } = useNewPostStore();

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft);
    router.push("/post");
  };
  return (
    <div className="w-full h-screen flex flex-col mt-40 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">
          Welcome to herocast
        </h2>
        <p className="text-lg text-muted-foreground">
          Build, engage and grow on Farcaster. Faster.
        </p>
        <div className="lg:max-w-lg mx-auto">
          <Card className="min-w-max bg-background text-foreground">
            <CardHeader className="space-y-1">
              <CardTitle className="flex">
                <CheckCircleIcon
                  className="-mt-0.5 mr-1 h-5 w-5 text-foreground/80"
                  aria-hidden="true"
                />
                Account added to herocast
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                You can start casting and browsing your feed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="-mx-2 -my-1.5 flex">
                <Button
                  onClick={() => router.push("/feeds")}
                  type="button"
                  variant="default"
                >
                  Scroll your feeds
                  <NewspaperIcon
                    className="ml-1.5 mt-0.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  onClick={() => onStartCasting()}
                  type="button"
                  variant="outline"
                  className="ml-4"
                >
                  Start casting
                  <PlusCircleIcon
                    className="ml-1.5 mt-0.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSuccessPage;
