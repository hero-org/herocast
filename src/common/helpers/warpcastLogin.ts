import { NobleEd25519Signer, bytesToHexString } from "@farcaster/hub-web";
import * as ed from "@noble/ed25519"

type KeyPairType = {
  publicKey: Uint8Array,
  privateKey: Uint8Array
}

type WarpcastLoginType = {
  token: string,
  deepLinkUrl: string
}

type WarpcastSignerType = {
  publicKey: string,
  privateKey: string,
  token: string,
  deepLinkUrl: string
}

export enum WarpcastLoginStatus {
  pending = "pending",
  success = "success",
  failure = "failure"
}


const WARPCAST_API_ENDPOINT = 'https://api.warpcast.com/v2/';
const headers = { "Content-Type": "application/json", };

const generateKeyPair = async (): Promise<KeyPairType> => {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return { publicKey, privateKey };
}

const createSignerRequest = async (publicKey: string, appName: string): Promise<WarpcastLoginType> => {
  const response = await fetch(`${WARPCAST_API_ENDPOINT}signer-requests`, {
    headers,
    method: "POST",
    body: JSON.stringify({ publicKey, name: appName }),
  });

  const { deepLinkUrl, token }: WarpcastLoginType = (await response.json()).result;
  return { deepLinkUrl, token };
}

const getSignerRequestStatus = async (signerToken: string) => {
  const response = await (await fetch(`${WARPCAST_API_ENDPOINT}signer-request?token=${signerToken}`, { headers })).json();
  return response ? response.result.signerRequest : null;
}

const generateWarpcastSigner = async (appName: string): Promise<WarpcastSignerType> => {
  const { publicKey, privateKey } = await generateKeyPair();
  const hexStringPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
  const hexStringPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();

  const { token, deepLinkUrl } = await createSignerRequest(hexStringPublicKey, appName);
  return { publicKey: hexStringPublicKey, privateKey: hexStringPrivateKey, token, deepLinkUrl };
}

const getWarpcastSignerStatus = async (signerToken: string): Promise<{ status: WarpcastLoginStatus, data: any }> => {
  const data = await getSignerRequestStatus(signerToken);
  const status = data.fid && data.messageHash ? WarpcastLoginStatus.success : WarpcastLoginStatus.pending;
  return { status, data }
}

const getWarpcastSigner = async (privateKey: string) => {
  const privateKey_encoded = Uint8Array.from(privateKey.split(",").map(split => Number(split)))
  return new NobleEd25519Signer(privateKey_encoded);
}

export { generateWarpcastSigner, getWarpcastSigner, getWarpcastSignerStatus };
