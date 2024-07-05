import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonCastRowProps = {
  text?: string;
  className?: string;
};
const SkeletonCastRow = ({ text, className }: SkeletonCastRowProps) => {
  const randomDelay = Math.floor(Math.random() * 2000);
  return (
    <div className={cn("flex items-start mx-2 space-x-4", className)}>
      <Skeleton
        className="h-10 w-10 rounded-full"
        style={{ animationDelay: `${randomDelay + 100}ms` }}
      />
      <div className="flex-1 space-y-2">
        <Skeleton
          className="h-4 w-1/4 rounded"
          style={{ animationDelay: `${randomDelay + 100}ms` }}
        />
        <div className="flex-1 space-y-2">
          {text ? (
            <div className="flex space-x-2">{text}</div>
          ) : (
            <>
              <Skeleton
                className="h-4 w-3/4 rounded"
                style={{ animationDelay: `${randomDelay + 300}ms` }}
              />
              <Skeleton
                className="h-4 w-1/2 rounded"
                style={{ animationDelay: `${randomDelay + 300}ms` }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkeletonCastRow;
