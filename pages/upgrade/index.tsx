import React, { useEffect, useState } from "react";
import { Radio, RadioGroup } from "@headlessui/react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@heroicons/react/24/outline";
import { XCircleIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { isPaidUser, useUserStore } from "../../src/stores/useUserStore";
import { useRouter } from "next/router";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/20/solid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { openWindow } from "@/common/helpers/navigation";
import Link from "next/link";
import Image from "next/image";
import herocastLogo from "../../public/images/logo.png";

function Logo(props: React.ComponentProps<"img">) {
  return (
    <Image
      src={herocastLogo}
      aria-hidden="true"
      alt="herocast logo"
      {...props}
    />
  );
}

const plans = [
  {
    name: "Open source",
    featured: false,
    price: { Monthly: "$0", Annually: "$0" },
    description: "Just curious? Enjoy herocast at no costs.",
    button: {
      Monthly: {
        label: "Get started for free",
        href: "https://app.herocast.xyz/login",
      },
      Annually: {
        label: "Get started for free",
        href: "https://app.herocast.xyz/login",
      },
    },
    features: [
      "1 Keyword Feed",
      "Schedule up to 3 casts",
      "1 Keyword Alert",
      "Analytics (7 days)",
      "Onchain user insights",
      "Connect up to 2 accounts",
    ],
    unavilableFeatures: [
      "Shared accounts",
      "Bespoke insights",
      "KOL identification",
    ],
    logomarkClassName: "fill-gray-300",
  },
  {
    name: "Creator",
    featured: false,
    price: { Monthly: "$15", Annually: "$10" },
    description: "Perfect for creators to create and engage more.",
    button: {
      Monthly: {
        label: "Subscribe",
        href: "https://buy.stripe.com/4gw03YeoO3Pz93i146",
      },
      Annually: {
        label: "Subscribe",
        href: "https://buy.stripe.com/fZeg2WeoObi193i288",
      },
    },
    features: [
      "2 Keyword Feeds",
      "Schedule up to 15 casts",
      "2 Keyword Alert",
      "Analytics (1 month)",
      "Onchain user insights",
      "Connect up to 2 accounts",
    ],
    unavilableFeatures: [
      "Shared accounts",
      "Bespoke insights",
      "KOL identification",
    ],
    logomarkClassName: "fill-gray-300",
  },
  {
    name: "Brand",
    featured: true,
    price: { Monthly: "$50", Annually: "$35" },
    description: "Ideal to grow and manage a brand.",
    button: {
      Monthly: {
        label: "Subscribe",
        href: "",
      },
      Annually: {
        label: "Subscribe",
        href: "",
      },
    },
    features: [
      "10 Keyword Feeds",
      "Schedule unlimited casts",
      "10 Keyword Alert",
      "Analytics (3 months)",
      "Onchain user insights",
      "Connect up to 5 accounts",
      "Shared accounts",
    ],
    unavilableFeatures: ["Bespoke insights", "KOL identification"],
    logomarkClassName: "fill-white",
  },
  {
    name: "Agency",
    featured: false,
    price: { Monthly: "Talk to us", Annually: "Talk to us" },
    description: "Best for maximizing growth with all features.",
    button: {
      Monthly: {
        label: "Reach out",
        href: "https://calendly.com/bijanfarsijani/25mincoffee",
      },
      Annually: {
        label: "Reach out",
        href: "https://calendly.com/bijanfarsijani/25mincoffee",
      },
    },
    features: [
      "15+ Keyword Feeds",
      "Schedule unlimited casts",
      "15+ Keyword Alert",
      "Analytics all-time history",
      "Onchain user insights",
      "Connect 5+ accounts",
      "Shared accounts",
      "Bespoke insights",
      "KOL identification",
    ],
    unavilableFeatures: [],
    logomarkClassName: "fill-gray-500",
  },
];

type PlanProps = {
  name: string;
  price: {
    Monthly: string;
    Annually: string;
  };
  description: string;
  button: {
    Monthly: { label: string; href: string };
    Annually: { label: string; href: string };
  };
  features: Array<string>;
  unavilableFeatures: Array<string>;
  activePeriod: "Monthly" | "Annually";
  logomarkClassName?: string;
  featured?: boolean;
};

function Plan({
  name,
  price,
  description,
  button,
  features,
  unavilableFeatures,
  activePeriod,
  logomarkClassName,
  featured = false,
}: PlanProps) {
  const isPayingUser = false; // isPaidUser();
  const isPaidPlan = price.Monthly !== "$0";

  const renderPlanButton = () => (
    <Link
      href={button[activePeriod].href}
      prefetch={false}
      className="w-full mx-auto"
    >
      <Button
        className="mt-6 w-full"
        disabled={!isPayingUser && !isPaidPlan}
        aria-label={`Get started with the ${name} plan for ${price[activePeriod]}`}
      >
        {!isPayingUser && isPaidPlan ? "Upgrade" : "Your plan"}
      </Button>
    </Link>
  );

  return (
    <div>
      <Card
        className={cn(
          "flex flex-col overflow-hidden rounded-3xl p-6",
          featured
            ? "order-first bg-gray-900 lg:order-none shadow-sm shadow-muted-foreground hover:shadow-foreground/40 hover:shadow-md transition-shadow duration-100"
            : "bg-white shadow-sm shadow-gray-900/5"
        )}
      >
        <h3
          className={cn(
            "flex items-center text-lg font-semibold",
            featured ? "text-white" : "text-gray-800"
          )}
        >
          <Logo className={cn("h-6 w-6 rounded-lg flex-none", logomarkClassName)} />
          <span className="ml-2">{name}</span>
        </h3>
        <p
          className={cn(
            "relative mt-5 flex text-3xl tracking-tight",
            featured ? "text-white" : "text-gray-800"
          )}
        >
          {price.Monthly === price.Annually ? (
            price.Monthly
          ) : (
            <>
              <span
                aria-hidden={activePeriod === "Annually"}
                className={cn(
                  "transition duration-300",
                  activePeriod === "Annually" &&
                    "pointer-events-none translate-x-6 select-none opacity-0"
                )}
              >
                {price.Monthly}
              </span>
              <span
                aria-hidden={activePeriod === "Monthly"}
                className={cn(
                  "absolute left-0 top-0 transition duration-300",
                  activePeriod === "Monthly" &&
                    "pointer-events-none -translate-x-6 select-none opacity-0"
                )}
              >
                {price.Annually}
              </span>
            </>
          )}
        </p>
        <p
          className={cn(
            "mt-3 text-sm",
            featured ? "text-gray-300" : "text-gray-700"
          )}
        >
          {description}
        </p>
        <div className="order-last mt-6">
          <ul
            role="list"
            className={cn(
              "-my-2 divide-y text-sm",
              featured
                ? "divide-gray-800 text-gray-300"
                : "divide-gray-200 text-gray-700"
            )}
          >
            {features.map((feature) => (
              <li key={feature} className="flex py-2">
                <CheckIcon
                  className={cn(
                    "h-6 w-6 flex-none",
                    featured ? "text-white" : "text-gray-800"
                  )}
                />
                <span className="ml-4">{feature}</span>
              </li>
            ))}
            {unavilableFeatures &&
              unavilableFeatures.map((feature) => (
                <li key={feature} className="flex py-2 opacity-50">
                  <XCircleIcon className="h-6 w-6 flex-none text-gray-400" />
                  <span className="ml-4">{feature}</span>
                </li>
              ))}
          </ul>
        </div>
        {renderPlanButton()}
      </Card>
    </div>
  );
}

export function Pricing() {
  const [activePeriod, setActivePeriod] = useState<"Monthly" | "Annually">(
    "Annually"
  );

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-8 flex justify-center">
          <div className="relative">
            <RadioGroup
              value={activePeriod}
              onChange={setActivePeriod}
              className="grid grid-cols-2"
            >
              {["Monthly", "Annually"].map((period) => (
                <Radio
                  key={period}
                  value={period}
                  className={cn(
                    "cursor-pointer border border-muted-foreground/30 px-[calc(theme(spacing.3)-1px)] py-[calc(theme(spacing.2)-1px)] text-sm text-foreground outline-2 outline-offset-2 transition-colors hover:border-foreground/10",
                    period === "Monthly"
                      ? "rounded-l-lg"
                      : "-ml-px rounded-r-lg"
                  )}
                >
                  {period}
                </Radio>
              ))}
            </RadioGroup>
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 z-5 shadow-none grid grid-cols-2 overflow-hidden rounded-md bg-gray-900 transition-all duration-300",
                activePeriod === "Monthly"
                  ? "[clip-path:inset(0_50%_0_0)]"
                  : "[clip-path:inset(0_0_0_calc(50%-1px))]"
              )}
            >
              {["Monthly", "Annually"].map((period) => (
                <div
                  key={period}
                  className={cn(
                    "py-2 text-center text-sm font-semibold text-white",
                    period === "Annually" && "-ml-px"
                  )}
                >
                  {period}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-4 grid max-w-full grid-cols-1 items-start gap-x-4 gap-y-10 sm:mt-8 md:grid-cols-2 g:max-w-none lg:grid-cols-4">
          {plans.map((plan) => (
            <Plan key={plan.name} {...plan} activePeriod={activePeriod} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function UpgradePage() {
  const router = useRouter();
  const { addUnsafeCustomerForUser } = useUserStore();
  const hasPaidViaStripe = router.query.success === "true";
  const isPayingUser = false; //isPaidUser();

  useEffect(() => {
    if (hasPaidViaStripe && !isPayingUser) {
      // this is a temporary hack until we integrate with Stripe webhooks
      addUnsafeCustomerForUser({
        stripe_customer_id: "manual_entry",
      });
    }
  }, [hasPaidViaStripe, isPayingUser]);

  const renderUpgradeContent = () => (
    <div className="flex min-h-full flex-1 flex-col px-6 py-8 lg:px-8 space-y-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-6 text-center text-3xl font-bold leading-9 tracking-tight text-foreground">
          Upgrade Herocast
        </h2>
        <p className="mt-2 text-center text-lg text-muted-foreground">
          Choose a plan that fits your needs and take your Farcaster experience
          to the next level.
        </p>
      </div>
      {!isPayingUser && (
        <div className="flex mx-auto">
          <Button
            type="button"
            size="lg"
            className="text-white text-base py-6 bg-gradient-to-r from-[#8A63D2] to-[#ff4eed] hover:from-[#6A4CA5] hover:to-[#c13ab3]"
            onClick={() =>
              openWindow(
                "https://www.hypersub.xyz/s/herocast-hyper-club-dbbiuv3cjwn4"
              )
            }
          >
            Upgrade on Hypersub <span className="ml-2">→</span>
          </Button>
        </div>
      )}
      <Pricing />
    </div>
  );

  const renderUpgradeSuccessContent = () => (
    <div className="m-6 flex min-h-full flex-1 flex-col px-6 py-8 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-3xl font-bold leading-9 tracking-tight text-foreground">
          Congratulations!
        </h2>
        <p className="mt-2 text-center text-lg text-muted-foreground">
          Your herocast Pro subscription is now active.
        </p>
      </div>
      <div className="mt-4 lg:max-w-lg mx-auto">
        <Card className="min-w-max bg-background text-foreground">
          <CardHeader className="space-y-1">
            <CardTitle className="flex">
              <CheckCircleIcon
                className="-mt-0.5 mr-1 h-5 w-5 text-foreground/80"
                aria-hidden="true"
              />
              Subscribed to herocast Pro
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              You can now schedule more casts and monitor more search terms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="-mx-2 -my-1.5 flex">
              <Button
                onClick={() => router.push("/search")}
                type="button"
                variant="default"
              >
                Add more search alerts
                <MagnifyingGlassIcon
                  className="ml-1.5 mt-0.5 h-4 w-4"
                  aria-hidden="true"
                />
              </Button>
              <Button
                onClick={() => router.push("/post")}
                type="button"
                variant="outline"
                className="ml-4"
              >
                Schedule more casts
                <PencilSquareIcon
                  className="ml-1.5 mt-0.5 h-4 w-4"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="bg-background">
      {isPayingUser ? renderUpgradeSuccessContent() : renderUpgradeContent()}
    </div>
  );
}
