"use client"

import React, { useEffect, useState } from "react";

import {
    CheckIcon,
    CaretSortIcon,
} from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
import { useAccount } from "wagmi"
import { getChain, getGlidePaymentOptions } from "../helpers/glide";
import { PaymentOption } from "node_modules/@paywithglide/glide-js/dist/types";
import { Hex } from "viem";
import { Loading } from "./Loading";

export interface RegistrationTransactionData {
    address?: Hex;
    registerSignature?: Hex;
    addSignature?: Hex;
    publicKey?: Hex;
    metadata?: Hex;
    deadline?: bigint;
    price?: bigint
    chainId: number;
}

export function PaymentSelector({
    registerPrice,
    chainId,
    registerSignature,
    addSignature,
    setPaymentOption,
    paymentOption,
    publicKey,
    metadata,
    deadline,
    setError
}) {
    const { address, isConnected } = useAccount();
    const [open, setOpen] = useState(false)
    const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
    const [isLoading, setIsLoading] = useState<Boolean>(false);
    const [isRetry, setIsRetry] = useState<Boolean>(false);

    const updatePaymentOptions = async (): Promise<void> => {
        console.log(address, registerSignature, publicKey, metadata, deadline)
        if (!address || !registerSignature || !publicKey || !metadata || !deadline) return;
        console.log('updatePaymentOptions', registerPrice)
        setIsLoading(true);
        setIsRetry(false);
        try {

            const paymentOptions = await getGlidePaymentOptions({
                chainId,
                address,
                registerSignature,
                addSignature,
                publicKey,
                metadata,
                deadline,
                price: registerPrice,
            });
            console.log("paymentOptions", paymentOptions)
            setPaymentOptions(paymentOptions);
            setIsLoading(false);
        } catch (error: any) {
            setIsRetry(true);
            setError(`There was an error fetching payment options. ${error.message}`);
            setIsLoading(false);
        }
    }

    const getPaymentOptionFromValue = (value: string) => {
        return paymentOptions.find((option) => (option.paymentCurrency === value));
    }

    useEffect(() => {
        if (!isConnected) return;

        updatePaymentOptions();
        return () => { }
    }, [isConnected, address, registerPrice, publicKey, deadline]);

    return (
        paymentOptions.length === 0
            ? <div className="py-3">{
                isLoading 
                ? <Loading isInline loadingMessage="Finding available payment tokens" /> 
                : isRetry ?
                    <Button variant="secondary" onClick={() => updatePaymentOptions()}>Retry</Button>
                    :"No Payment Methods Available"
                }
               </div>
            : <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[450px] justify-between"
                    >
                        {paymentOption
                            ? (<div className="flex">
                                <img src={paymentOption.currencyLogoURL} className="h-5 shrink-0 mr-1" />
                                {`${paymentOption.currencyName} on ${getChain(paymentOption.paymentCurrency.split('/')[0], 'name')}`}
                                <span className="ml-1 text-[0.8rem] text-muted-foreground">
                                    ({`${paymentOption.balance} ${paymentOption.currencySymbol}`})
                                </span>
                            </div>)
                            : "Select token..."}
                        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0">
                    <Command>
                        <CommandGroup>
                            {paymentOptions.map((option) => (
                                <CommandItem
                                    key={option.paymentCurrency}
                                    value={option.paymentCurrency}
                                    onSelect={async (currentValue) => {
                                        const isDeselect = currentValue.toLowerCase() === paymentOption?.paymentCurrency.toLowerCase();
                                        const selectedPaymentOption = getPaymentOptionFromValue(currentValue);
                                        if (!isDeselect && selectedPaymentOption) {
                                            setPaymentOption(selectedPaymentOption);
                                            setOpen(false);
                                        }
                                    }}
                                >
                                    {paymentOption && <CheckIcon
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            paymentOption.paymentCurrency === option.paymentCurrency ? "opacity-100" : "opacity-0"
                                        )}
                                    />}

                                    <img
                                        src={option.currencyLogoURL}
                                        className="ml-2 h-4 w-4 shrink-0 mr-1"
                                    />
                                    {`${option.currencyName} on ${getChain(option.paymentCurrency.split('/')[0], 'name')}`}
                                    <span className="ml-1 text-[0.8rem] text-muted-foreground">
                                        {`${option.balance} ${option.currencySymbol} (~$${Number(option.balanceUSD).toFixed(2)})`}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
    )
}
