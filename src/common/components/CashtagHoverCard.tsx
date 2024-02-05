import React, { useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { openWindow } from "../helpers/navigation";
import { Loading } from "./Loading";
import { useInView } from "react-intersection-observer";
import { DexPair, PriceChange, useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import { Button } from "@/components/ui/button";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

type CashtagHoverCardProps = {
  tokenSymbol: string;
  userFid: string | number;
  children: React.ReactNode;
};

const DEX_SCREENER_API_ENDPOINT = 'https://api.dexscreener.com/latest/dex/search/?q=';

const CashtagHoverCard = ({
  userFid,
  tokenSymbol, // must be uppercause, because is used as key in data store and for lookup
  children,
}: CashtagHoverCardProps) => {
  const { addTokenData } = useDataStore();
  const tokenData = useDataStore((state) => get(state.tokenSymbolToData, tokenSymbol));
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  useEffect(() => {
    if (!inView || tokenData) return;

    const getData = async () => {
      try {
        const apiEndpoint = `${DEX_SCREENER_API_ENDPOINT}${tokenSymbol}`;
        const resp = await fetch(apiEndpoint);
        const data = await resp.json();
        if (!data.pairs) {
          return;
        }

        const tradingPairs = data.pairs.filter((pair) => pair.baseToken.symbol === tokenSymbol);
        const pairsByFdv = tradingPairs.sort((a, b) => b.fdv - a.fdv);
        const highestFdvPair: DexPair = pairsByFdv[0];
        
        if (highestFdvPair) {
          addTokenData({ tokenSymbol, data: highestFdvPair });
        }
      } catch (err) {
        console.log("CashtagHoverCard: err getting data", err);
      }
    };

    getData();
  }, [inView, tokenData, userFid]);

  const onClick = () => {
    if (!tokenData) return;

    openWindow(tokenData.url);
  };

  const renderPriceChangeRow = (label: string, value: string) => {
    const color = value.startsWith("-") ? "text-red-500" : "text-green-500";
    return (
      <div className="mx-auto flex max-w-xs flex-col items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={`text-sm font-semibold tracking-tight ${color}`}>
          {value}
        </span>
      </div>
    );
  }
  const renderPriceChanges = (priceChange: PriceChange) => {
    return (
      <dl className="grid grid-cols-3 gap-x-2 gap-y-2 text-center">
        {renderPriceChangeRow('5MIN', `${priceChange.m5}%`)}
        {renderPriceChangeRow('1H', `${priceChange.h1}%`)}
        {renderPriceChangeRow('24H', `${priceChange.h24}%`)}
      </dl>
    )
  }

  return (
    <HoverCard openDelay={0.1}>
      <HoverCardTrigger onClick={onClick} ref={ref}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        onClick={onClick}
        side="right"
        className="border border-gray-400 overflow-hidden"
      >
        <div className="space-y-1">
          {tokenData ? (<div>
            <h2 className="text-md font-semibold">{tokenData?.priceUsd} USD</h2>
            <h3 className="text-sm font-regular">{tokenData?.baseToken.name}</h3>
          </div>) : (
            <h2 className="text-md font-semibold">{tokenSymbol}</h2>
          )}
          {tokenData ? (
            <>
              <p className="flex pt-2 text-md break-words">
                Price: {tokenData?.priceUsd} USD
              </p>
              <p className="flex text-md break-words">
                1 USD ~= {(1.0 / parseFloat(tokenData?.priceUsd)).toFixed(2)} {tokenSymbol}
              </p>
              {renderPriceChanges(tokenData.priceChange)}
              <Button className="" variant="outline">
                <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-2" />
                DexScreener 
              </Button>
            </>
          ) : (
            <Loading />
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default CashtagHoverCard;
