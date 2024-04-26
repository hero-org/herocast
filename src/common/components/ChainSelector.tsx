"use client"

import React, { useEffect } from "react";
import { ethers } from 'ethers';
import { switchChain } from '@wagmi/core'
import {
    getBalance,
} from '@wagmi/core'

import {
    CheckIcon,
    CaretSortIcon,
} from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { config } from "@/common/helpers/rainbowkit";

import {
    Command,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { arbitrum, base, optimism, zora } from "viem/chains"
import { useAccount } from "wagmi"

interface Chain {
    value: string;
    label: string;
    icon: string;
    chainId: number;
    balance: undefined | bigint;
}

let defaultChains: Chain[] = [
    {
        value: "op mainnet",
        label: "Optimism",
        icon: "images/optimism.svg",
        chainId: optimism.id,
        balance: undefined,
    },
    {
        value: "base",
        label: "Base",
        icon: 'images/base.png',
        chainId: base.id,
        balance: undefined,
    },
    {
        value: "zora",
        label: "Zora",
        icon: 'images/zora.svg',
        chainId: zora.id,
        balance: undefined,
    },
    {
        value: "arbitrum one",
        label: "Arbitrum One",
        icon: 'images/arbitrum.png',
        chainId: arbitrum.id,
        balance: undefined,
    },
];

export function ChainSelector({ handleChainSelection }) {
    const { address, isConnected, chainId, chain } = useAccount();
    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState(chain?.name.toLowerCase() || 'op mainnet');
    const [chains, setChains] = React.useState(defaultChains);

    console.log(chain, chain?.name);

    const getWalletBalance = async (manualChainId: number | undefined): Promise<bigint | undefined> => {
        if (!address) return;

        const { value } = await getBalance(config, {
            address,
            chainId: manualChainId || chainId,
        });

        return value;
    }

    const updateAccountBalances = async (): Promise<bigint | undefined> => {
        if (!address && !isConnected) return;


        const balances = await Promise.all(chains.map(async (chain) => {
            const balance = await getWalletBalance(chain.chainId);

            if (chain.value === value && (balance && balance > 0n)) {
                handleChainSelection(true);
            }
            return {
                ...chain,
                balance: balance || 0n,
            }
        }))

        setChains(balances);
    }

    useEffect(() => {
        if (!isConnected) return;
        console.log('isConnected', chain)
        if (chain) {
            setValue(chain.name.toLowerCase())
        }
        updateAccountBalances();
        return () => { }
    }, [isConnected, address]);

    const getChain = (value: string) => {
        return chains.find((chain) => chain.value === value)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[350px] justify-between"
                >
                    {value
                        ? (<div className="flex"><img src={getChain(value)?.icon} className="h-5 shrink-0 mr-1" /> {getChain(value)?.label} <span className="ml-1 text-[0.8rem] text-muted-foreground">({ethers.formatEther(getChain(value)?.balance || 0n)} Ξ)</span></div>)
                        : "Select chain..."}
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0">
                <Command>
                    <CommandGroup>
                        {chains.map((chain) => (
                            <CommandItem
                                key={chain.value}
                                value={chain.value}
                                onSelect={async (currentValue) => {
                                    const isDeselect = currentValue.toLowerCase() === value.toLowerCase();
                                   console.log(currentValue);
                                    if (!isDeselect) {
                                        const chain = getChain(currentValue);

                                        setValue(currentValue)
                                        setOpen(false)
                                        
                                        try {
                                            if (chain) {

                                                const result = await switchChain(config, {
                                                    chainId: chain.chainId,
                                                });

                                                if (result) {
                                                    handleChainSelection(true);
                                                } else {
                                                    console.log("error", result)
                                                }
                                            }
                                        } catch (error) {
                                            handleChainSelection(false);
                                        }
                                    }
                                }}
                                disabled={chain.balance === 0n || chain.balance === undefined}
                            >
                                {value && <CheckIcon
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === chain.value ? "opacity-100" : "opacity-0"
                                    )}
                                />}

                                <img src={chain.icon} className="ml-2 h-4 w-4 shrink-0 mr-1" />{chain.label}<span className="ml-1 text-[0.8rem] text-muted-foreground">{chain.balance !== undefined ? `(${ethers.formatEther(chain.balance)} Ξ)` : ''}</span>

                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
