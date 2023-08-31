import { NobleEd25519Signer, bytesToHexString } from "@farcaster/hub-web";
import * as ed from "@noble/ed25519"
import { toBytes } from 'viem'
import { mnemonicToAccount, signTypedData } from "viem/accounts";
import axios from "axios";

type KeyPairType = {
  publicKey: Uint8Array,
  privateKey: Uint8Array
}

type WarpcastLoginType = {
  token: string,
  deeplinkUrl: string
}

type WarpcastSignerType = {
  publicKey: string,
  privateKey: string,
  token: string,
  deeplinkUrl: string
}

export enum WarpcastLoginStatus {
  pending = "pending",
  success = "success",
  failure = "failure"
}

const VITE_APP_FID = import.meta.env.VITE_APP_FID
const VITE_APP_MNENOMIC = import.meta.env.VITE_APP_MNENOMIC

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: "Farcaster SignedKeyRequestValidator",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
  { name: "requestFid", type: "uint256" },
  { name: "key", type: "bytes" },
  { name: "deadline", type: "uint256" },
] as const;

const WARPCAST_API_ENDPOINT = 'https://api.warpcast.com/v2/';
const headers = { "Content-Type": "application/json", };

const generateKeyPair = async (): Promise<KeyPairType> => {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return { publicKey, privateKey };
}


const createSignerRequest = async (publicKey: string, requestFid: string, signature: string, deadline: number): Promise<WarpcastLoginType> => {
  const payload = { key: publicKey, requestFid, signature, deadline }
  console.log('createSignerRequest', payload);

  // const response = await fetch(`${WARPCAST_API_ENDPOINT}signed-key-requests`, {
  //   headers,
  //   method: "POST",
  //   body: JSON.stringify(payload),
  // });

  const { token, deeplinkUrl } = await axios
    .post(`${WARPCAST_API_ENDPOINT}signed-key-requests`, {
      key: publicKey,
      requestFid,
      signature,
      deadline,
    })
    .then((response) => response.data.result.signedKeyRequest);

  // console.log('createSignerRequest', response)
  // const { deeplinkUrl, token }: WarpcastLoginType = (await response.json()).result.signedKeyRequest;
  return { deeplinkUrl, token };
}

const getSignerRequestStatus = async (signerToken: string) => {
  console.log('getSignerRequestStatus', signerToken);
  const data = await (await fetch(`${WARPCAST_API_ENDPOINT}signed-key-request?token=${signerToken}`, { headers })).json();
  return data.result.signedKeyRequest;
}

const generateWarpcastSigner = async (): Promise<WarpcastSignerType> => {
  const { publicKey, privateKey } = await generateKeyPair();
  const hexStringPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
  const hexStringPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();

  const appAccount = mnemonicToAccount(VITE_APP_MNENOMIC);
  const requestFid = VITE_APP_FID;
  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
  const signature = await appAccount.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: "SignedKeyRequest",
    message: {
      requestFid: BigInt(requestFid),
      key: hexStringPublicKey,
      deadline: BigInt(deadline),
    },
  });

  const { token, deeplinkUrl } = await createSignerRequest(hexStringPublicKey, requestFid, signature, deadline);
  return { publicKey: hexStringPublicKey, privateKey: hexStringPrivateKey, token, deeplinkUrl };
}

const getWarpcastSignerStatus = async (signerToken: string): Promise<{ status: WarpcastLoginStatus, data: any }> => {
  const data = await getSignerRequestStatus(signerToken);
  const status = data && data.state === 'completed' ? WarpcastLoginStatus.success : WarpcastLoginStatus.pending;
  return { status, data: data }
}

const getWarpcastSigner = async (privateKey: string) => {
  const privateKeyEncoded = toBytes(privateKey) // Uint8Array.from(privateKey.split(",").map(split => Number(split)))
  return new NobleEd25519Signer(privateKeyEncoded);
}

export { generateWarpcastSigner, getWarpcastSigner, getWarpcastSignerStatus };
