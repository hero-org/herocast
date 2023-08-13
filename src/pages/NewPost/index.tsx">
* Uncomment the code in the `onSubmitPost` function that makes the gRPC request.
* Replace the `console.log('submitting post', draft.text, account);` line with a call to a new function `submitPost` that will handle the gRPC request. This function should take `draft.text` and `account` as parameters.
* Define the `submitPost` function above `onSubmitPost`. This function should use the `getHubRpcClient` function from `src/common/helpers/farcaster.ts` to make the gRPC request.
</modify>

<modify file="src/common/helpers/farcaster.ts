import { getHubRpcClient } from "@/common/helpers/farcaster";

// Define the submitPost function
async function submitPost(text: string, account: any) {
  const hub = getHubRpcClient(HUB_URL, { debug: true });
  const signer = await getWarpcastSigner(account.privateKey);
  try {
    const cast = (await makeCastAdd({
      text: text,
      embeds: [],
      embedsDeprecated: [],
      mentions: [],
      mentionsPositions: [],
    }, { fid: parseInt(account.platformAccountId), network: FarcasterNetwork.MAINNET }, signer))._unsafeUnwrap();
    hub.submitMessage(cast);
  } catch (e) {
    console.log('error', e);
  }
}

// Modify the onSubmitPost function
const onSubmitPost = async ({ draft, draftId }: { draft: PostType, draftId: number }) => {
  if (draft.text.length > 0) {
    submitPost(draft.text, account);
    publishPostDraft(draftId);
  }
}
```
```typescript
// Modify the getHubRpcClient function
const getHubRpcClient = (url: string, options: any) => {
  const PROXY_URL = "https://cors-proxy.example.com/";
  const getHubRpcClient = (url: string, options: any) => {
    const client = grpc.makeGenericClientConstructor({}, PROXY_URL + url, options);
    return client;
  }

