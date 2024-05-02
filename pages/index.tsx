import React, { useEffect } from "react";
import { useRouter } from "next/router";

const Index = () => {
  const router = useRouter();

  return (
    <p className="m-4 text-gray-800 dark:text-gray-200 text-md">
      Redirecting...
    </p>
  );
};

export default Index;
