import React from "react";

("use client");

import { useState } from "react";
import { Radio, RadioGroup } from "@headlessui/react";
import clsx from "clsx";

import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Logomark } from "@/components/Logo";

const plans = [
  {
    name: "Open source",
    featured: false,
    price: { Monthly: "$0", Annually: "$0" },
    description: "Perfect for starters. Enjoy growth with no costs.",
    button: {
      label: "Get started for free",
      href: "https://app.herocast.xyz/login",
    },
    features: [
      "Custom feeds ",
      "Schedule casts",
      "Custom notifications",
      "Monitoring of 1 search term",
      "Connect up to 2 accounts",
    ],
    unavilableFeatures: [
      "Shared accounts",
      "Analytics",
      "Bespoke insights",
      "KOL identification",
    ],
    logomarkClassName: "fill-gray-300",
  },
  {
    name: "Pro",
    featured: true,
    price: { Monthly: "$35", Annually: "$50" },
    description: "Ideal for those looking to accelerate their growth.",
    button: {
      label: "Subscribe",
      href: "https://app.herocast.xyz/login",
    },
    features: [
      "Custom feeds ",
      "Schedule casts",
      "Custom notifications",
      "Monitoring of 1 search term",
      "Connect up to 2 accounts",
      "Shared accounts",
      "Analytics (soon)",
    ],
    unavilableFeatures: ["Bespoke insights", "KOL identification"],
    logomarkClassName: "fill-white",
  },
  {
    name: "Agency",
    featured: false,
    price: { Monthly: "Talk to us", Annually: "Talk to us" },
    description: "Best for maximizing growth with all features included.",
    button: {
      label: "Reach out",
      href: "https://calendly.com/bijanfarsijani/25mincoffee",
    },
    features: [
      "Custom feeds ",
      "Schedule casts",
      "Custom notifications",
      "Monitoring of 1 search term",
      "Connect up to 2 accounts",
      "Shared accounts",
      "Analytics (soon)",
      "Bespoke insights",
      "KOL identification",
    ],
    unavilableFeatures: [],
    logomarkClassName: "fill-gray-500",
  },
];

function CheckIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M9.307 12.248a.75.75 0 1 0-1.114 1.004l1.114-1.004ZM11 15.25l-.557.502a.75.75 0 0 0 1.15-.043L11 15.25Zm4.844-5.041a.75.75 0 0 0-1.188-.918l1.188.918Zm-7.651 3.043 2.25 2.5 1.114-1.004-2.25-2.5-1.114 1.004Zm3.4 2.457 4.25-5.5-1.187-.918-4.25 5.5 1.188.918Z"
        fill="currentColor"
      />
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircleIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}
type PlanProps = {
  name: string;
  price: {
    Monthly: string;
    Annually: string;
  };
  description: string;
  button: {
    label: string;
    href: string;
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
  return (
    <section
      className={clsx(
        "flex flex-col overflow-hidden rounded-3xl p-6 ",
        featured
          ? "order-first bg-[#0B0B0B] lg:order-none shadow-xl shadow-gray-300 hover:shadow-gray-400 hover:shadow-2xl transition-shadow duration-100"
          : "bg-white shadow-lg shadow-gray-900/5"
      )}
    >
      <h3
        className={clsx(
          "flex items-center text-sm font-semibold",
          featured ? "text-white" : "text-gray-900"
        )}
      >
        <Logomark className={clsx("h-6 w-6 flex-none", logomarkClassName)} />
        <span className="ml-4">{name}</span>
      </h3>
      <p
        className={clsx(
          "relative mt-5 flex text-3xl tracking-tight",
          featured ? "text-white" : "text-gray-900"
        )}
      >
        {price.Monthly === price.Annually ? (
          price.Monthly
        ) : (
          <>
            <span
              aria-hidden={activePeriod === "Annually"}
              className={clsx(
                "transition duration-300",
                activePeriod === "Annually" &&
                  "pointer-events-none translate-x-6 select-none opacity-0"
              )}
            >
              {price.Monthly}
            </span>
            <span
              aria-hidden={activePeriod === "Monthly"}
              className={clsx(
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
        className={clsx(
          "mt-3 text-sm",
          featured ? "text-gray-300" : "text-gray-700"
        )}
      >
        {description}
      </p>
      <div className="order-last mt-6">
        <ul
          role="list"
          className={clsx(
            "-my-2 divide-y text-sm",
            featured
              ? "divide-gray-800 text-gray-300"
              : "divide-gray-200 text-gray-700"
          )}
        >
          {features.map((feature) => (
            <li key={feature} className="flex py-2">
              <CheckIcon
                className={clsx(
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
      <Button
        href={button.href}
        color={featured ? "gray" : "gray"}
        variant={featured ? "solid" : "solid"}
        className="mt-6"
        aria-label={`Get started with the ${name} plan for ${price}`}
      >
        {button.label}
      </Button>
    </section>
  );
}

export function Pricing() {
  let [activePeriod, setActivePeriod] = useState<"Monthly" | "Annually">(
    "Monthly"
  );

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="border-t border-gray-200 bg-gray-100 py-20 sm:py-32"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-title"
            className="text-3xl font-medium tracking-tight text-gray-900"
          >
            Simple Pricing, No Hidden Fees
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            Choose a plan that fits your needs, from individuals looking to get
            ahead to brands aiming for market dominance. We’ve got you covered.
          </p>
        </div>

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
                  className={clsx(
                    "cursor-pointer border border-gray-300 px-[calc(theme(spacing.3)-1px)] py-[calc(theme(spacing.2)-1px)] text-sm text-gray-700 outline-2 outline-offset-2 transition-colors hover:border-gray-400",
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
              className={clsx(
                "pointer-events-none absolute inset-0 z-10 grid grid-cols-2 overflow-hidden rounded-lg bg-gray-900 transition-all duration-300",
                activePeriod === "Monthly"
                  ? "[clip-path:inset(0_50%_0_0)]"
                  : "[clip-path:inset(0_0_0_calc(50%-1px))]"
              )}
            >
              {["Monthly", "Annually"].map((period) => (
                <div
                  key={period}
                  className={clsx(
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

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 items-start gap-x-8 gap-y-10 sm:mt-20 lg:max-w-none lg:grid-cols-3">
          {plans.map((plan) => (
            <Plan key={plan.name} {...plan} activePeriod={activePeriod} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export default function UpgradePage() {
  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-foreground">
            Intro to herocast
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          ...coming soon...
        </div>
      </div>
    </>
  );
}
