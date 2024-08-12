import React, { useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { isAddress } from "viem";
import { getAddressFromEnsName } from "../helpers/ens";
import { getEnsNameForAddress } from "../helpers/ens";
import { useAccount } from "wagmi";

const EnsLookupLabel = ({ addressOrName }: { addressOrName: string }) => {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected) return;

    if (addressOrName && addressOrName.endsWith(".eth")) {
      getAddressFromEnsName(addressOrName).then((ensAddress) => {
        setAddress(ensAddress);
      });
      return;
    }

    if (isAddress(addressOrName)) {
      getEnsNameForAddress(addressOrName).then((ensName) => {
        setEnsName(ensName);
      });
    }

    return () => {
      setEnsName(null);
      setAddress(null);
    };
  }, [addressOrName, isConnected]);

  if (!addressOrName) return null;

  return (
    (ensName || address) && (
      <a
        href={`https://etherscan.io/address/${addressOrName}`}
        target="_blank"
        rel="noreferrer"
        className="flex text-sm hover:underline"
      >
        {ensName || address}{" "}
        <ArrowTopRightOnSquareIcon className="ml-1 mt-0.5 h-4 w-4" />
      </a>
    )
  );
};

export default EnsLookupLabel;
