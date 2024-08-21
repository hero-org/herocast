import React from "react";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
} from "@heroicons/react/20/solid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useDraftStore } from "@/stores/useDraftStore";
import { JoinedHerocastPostDraft } from "@/common/constants/postDrafts";
import Link from "next/link";

const WelcomeSuccessPage = () => {
  const router = useRouter();
  const { addNewPostDraft } = useDraftStore();

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft);
    router.push("/post");
  };
  return (
    <div className="w-full flex flex-col mt-24 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">Welcome to herocast</h2>
        <div className="max-w-xl mx-auto">
          <Card className="min-w-max bg-background text-foreground">
            <CardHeader className="space-y-1">
              <CardTitle className="flex">
                <CheckCircleIcon className="-mt-0.5 mr-1 h-5 w-5 text-foreground/80" aria-hidden="true" />
                Account added to herocast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-y-4 text-left">
                <div>
                  <span className="text-md font-semibold">Get started with herocast</span>
                  <ul className="ml-1 list-disc list-inside">
                    <li>Create an alert to get notified when someone mentions a keyword</li>
                    <li>Pin Channels to access them faster in your Feeds</li>
                    <li>Schedule casts to save time</li>
                  </ul>
                </div>
                <div className="gap-x-4 mt-2 flex">
                  <Link href="/search">
                    <Button size="lg" type="button" variant="default">
                      <MagnifyingGlassIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Setup a keyword alert
                    </Button>
                  </Link>
                  <Link href="/channels">
                    <Button size="lg" type="button" variant="outline">
                      <RectangleGroupIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Pin your channels
                    </Button>
                  </Link>
                  <Button onClick={() => onStartCasting()} type="button" variant="outline" size="lg">
                    <PencilSquareIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                    Start casting
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSuccessPage;
