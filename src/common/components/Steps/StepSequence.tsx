import React, { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./SidebarNav";
import findIndex from "lodash.findindex";

type StepSequenceProps = {
  title: string;
  description: string;
  navItems: {
    key: string;
    idx: number;
    title: string;
  }[];
  step: string;
  setStep: (string) => void;
  renderStep: (string) => ReactNode;
};

const StepSequence = ({
  title,
  description,
  navItems,
    step,
  setStep,
  renderStep,
}: StepSequenceProps) => {

  const progressPercent =
    (findIndex(navItems, (item) => item.key === step) / navItems.length) * 120;

  return (
    <div className="w-full">
      <div className="space-y-6 pb-10 block">
        <div className="space-y-1 max-w-lg">
          <h2 className="text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground">
            {description}
          </p>
          <Progress value={progressPercent} indicatorClassName="bg-gradient-to-r from-green-400 to-green-600 animate-pulse"/>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="-mx-4 lg:w-2/7">
            <SidebarNav
              items={navItems}
              step={step}
              onClick={(step) => setStep(step)}
            />
          </aside>
          <div className="flex-1 max-w-xl lg:max-w-4xl">{renderStep(step)}</div>
        </div>
      </div>
    </div>
  );
};

export default StepSequence;
