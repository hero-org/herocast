import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const SkeletonCastRow = () => {
  const randomDelay = Math.floor(Math.random() * 2000);
  return (
    <div className="flex items-start mx-2 space-x-4">
      <Skeleton
        className="h-10 w-10 rounded-full"
        style={{ animationDelay: `${randomDelay + 100}ms` }}
      />
      <div className="flex-1 space-y-4">
        <Skeleton
          className="h-4 w-1/4 rounded"
          style={{ animationDelay: `${randomDelay + 100}ms` }}
        />
        <div className="flex-1 space-y-2">
          <Skeleton
            className="h-4 w-3/4 rounded"
            style={{ animationDelay: `${randomDelay + 300}ms` }}
          />
          <Skeleton
            className="h-4 w-1/2 rounded"
            style={{ animationDelay: `${randomDelay + 300}ms` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SkeletonCastRow;
