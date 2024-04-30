import React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openWindow } from "@/common/helpers/navigation";

const SignupForNonLocalAccountCard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex">
          You are using a readonly account{" "}
          <ArrowDownTrayIcon className="ml-2 mt-1 w-6 h-6" />
        </CardTitle>
        <CardDescription>
          A readonly account is great for browsing, but you need a full account
          to start casting and interact with others on Farcaster.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          variant="default"
          onClick={() => openWindow(`${process.env.NEXT_PUBLIC_URL}/login`)}
        >
          Switch to a full account
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SignupForNonLocalAccountCard;