import { getEnsAddress, getEnsName } from "@wagmi/core";
import { normalize } from "viem/ens";
import { mainnetConfig } from "./rainbowkit";


export const getAddressFromEnsName = async (name: string) => {
    try {
        const ensAddress = await getEnsAddress(mainnetConfig, {
            name: normalize(name),
        });
        return ensAddress;
    } catch (e) {
        console.error(`Failed to get address for ENS name: ${name}`, e);
        return null;
    }
};

export const getEnsNameForAddress = async (address: `0x${string}`) => {
    try {
        const ensName = await getEnsName(mainnetConfig, {
            address,
        });
        return ensName;
    } catch (e) {
        console.error(`Failed to get ENS name for address: ${address}`, e);
        return null;
    }
};

export const convertEnsNameToAddress = async (ensName: string) => {
    if (ensName.endsWith(".eth")) {
        return await getAddressFromEnsName(ensName);
    }
    return ensName;
};

export const convertEnsNamesToAddresses = async (ensNames: string[]) => {
    return await Promise.all(ensNames.map(async (ensName) => await convertEnsNameToAddress(ensName)));
};
