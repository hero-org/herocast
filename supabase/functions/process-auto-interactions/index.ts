import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  makeReactionAdd,
  makeCastAdd,
  FarcasterNetwork,
  ReactionType,
  getSSLHubRpcClient,
  Message,
} from 'https://esm.sh/@farcaster/core@0.14.0';
import { hexToBytes } from 'https://esm.sh/@noble/hashes@1.3.2/utils';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NEYNAR_API_KEY = Deno.env.get('NEYNAR_API_KEY')!;

interface AutoInteractionListContent {
  fids: string[];
  displayNames?: Record<string, string>;
  sourceAccountId: string;
  actionType: 'like' | 'recast' | 'both';
  onlyTopCasts: boolean;
  requireMentions?: string[];
  lastProcessedHash?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all auto-interaction lists
    const { data: lists, error: listsError } = await supabase.from('list').select('*').eq('type', 'auto_interaction');

    if (listsError) {
      throw new Error(`Failed to fetch auto-interaction lists: ${listsError.message}`);
    }

    console.log(`Processing ${lists?.length || 0} auto-interaction lists`);

    for (const list of lists || []) {
      try {
        await processAutoInteractionList(supabase, list);
      } catch (error) {
        console.error(`Error processing list ${list.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: lists?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in process-auto-interactions:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function processAutoInteractionList(supabase: any, list: any) {
  const content = list.contents as AutoInteractionListContent;

  if (!content.fids || content.fids.length === 0) {
    console.log(`List ${list.id} has no FIDs to monitor`);
    return;
  }

  // Get the source account details
  const { data: sourceAccount, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', content.sourceAccountId)
    .single();

  if (accountError || !sourceAccount) {
    throw new Error(`Failed to fetch source account: ${accountError?.message}`);
  }

  // Decrypt the private key
  const { data: decryptedData, error: decryptError } = await supabase.rpc('decrypted_account', {
    account_id: content.sourceAccountId,
  });

  if (decryptError || !decryptedData) {
    throw new Error(`Failed to decrypt account: ${decryptError?.message}`);
  }

  const privateKey = decryptedData.decrypted_private_key;

  // Fetch recent casts from target FIDs
  const casts = await fetchRecentCasts(content.fids, content.lastProcessedHash);

  console.log(`Found ${casts.length} casts to process for list ${list.id}`);

  let processedCount = 0;
  let lastHash = content.lastProcessedHash;

  for (const cast of casts) {
    // Apply filters
    if (!shouldProcessCast(cast, content)) {
      continue;
    }

    // Check if we've already processed this cast
    const { data: existing } = await supabase
      .from('auto_interaction_history')
      .select('*')
      .eq('list_id', list.id)
      .eq('cast_hash', cast.hash);

    if (existing && existing.length > 0) {
      continue;
    }

    // Perform the interaction
    try {
      if (content.actionType === 'like' || content.actionType === 'both') {
        await performLike(cast.hash, privateKey, sourceAccount.platform_account_id, cast.author.fid);

        // Record the action
        await supabase.from('auto_interaction_history').insert({
          list_id: list.id,
          cast_hash: cast.hash,
          action: 'like',
        });
      }

      if (content.actionType === 'recast' || content.actionType === 'both') {
        await performRecast(cast.hash, privateKey, sourceAccount.platform_account_id, cast.author.fid);

        // Record the action
        await supabase.from('auto_interaction_history').insert({
          list_id: list.id,
          cast_hash: cast.hash,
          action: 'recast',
        });
      }

      processedCount++;
      lastHash = cast.hash;
    } catch (error) {
      console.error(`Failed to process cast ${cast.hash}:`, error);
    }
  }

  // Update last processed hash if we processed any casts
  if (processedCount > 0 && lastHash !== content.lastProcessedHash) {
    const updatedContent = { ...content, lastProcessedHash: lastHash };
    await supabase.from('list').update({ contents: updatedContent }).eq('id', list.id);
  }

  console.log(`Processed ${processedCount} casts for list ${list.id}`);
}

function shouldProcessCast(cast: any, content: AutoInteractionListContent): boolean {
  // Check if it's a top-level cast
  if (content.onlyTopCasts && cast.parent_hash) {
    return false;
  }

  // Check mention requirements
  if (content.requireMentions && content.requireMentions.length > 0) {
    const mentionedFids = extractMentionedFids(cast);
    const hasRequiredMention = content.requireMentions.some((fid) => mentionedFids.includes(fid));
    if (!hasRequiredMention) {
      return false;
    }
  }

  return true;
}

function extractMentionedFids(cast: any): string[] {
  const fids: string[] = [];

  // Extract from mentioned_profiles if available
  if (cast.mentioned_profiles) {
    cast.mentioned_profiles.forEach((profile: any) => {
      fids.push(profile.fid.toString());
    });
  }

  // Also check embeds for mentions
  if (cast.embeds) {
    cast.embeds.forEach((embed: any) => {
      if (embed.user && embed.user.fid) {
        fids.push(embed.user.fid.toString());
      }
    });
  }

  return fids;
}

async function fetchRecentCasts(fids: string[], lastProcessedHash?: string): Promise<any[]> {
  const response = await fetch(`https://api.neynar.com/v2/farcaster/feed?fids=${fids.join(',')}&limit=50`, {
    headers: {
      api_key: NEYNAR_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch casts: ${response.statusText}`);
  }

  const data = await response.json();
  const casts = data.casts || [];

  // If we have a last processed hash, filter out older casts
  if (lastProcessedHash) {
    const lastIndex = casts.findIndex((c: any) => c.hash === lastProcessedHash);
    if (lastIndex >= 0) {
      return casts.slice(0, lastIndex);
    }
  }

  return casts;
}

async function performLike(castHash: string, privateKey: string, signerFid: string, targetFid: number) {
  try {
    // Convert the cast hash from hex string to bytes
    const targetHash = hexToBytes(castHash.startsWith('0x') ? castHash.slice(2) : castHash);

    // Convert private key from hex string to bytes
    const privateKeyBytes = hexToBytes(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey);

    // Create the reaction add message
    const reactionAdd = await makeReactionAdd(
      {
        type: ReactionType.LIKE,
        targetCastId: {
          hash: targetHash,
          fid: BigInt(targetFid),
        },
      },
      { fid: Number(signerFid), network: FarcasterNetwork.MAINNET },
      privateKeyBytes
    );

    if (reactionAdd.isErr()) {
      throw new Error(`Failed to create like: ${reactionAdd.error}`);
    }

    // Submit to Farcaster hub with fallback options
    const hubUrls = [
      'hub-grpc.pinata.cloud',
      'nemes.farcaster.xyz:2283',
      'hoyt.farcaster.xyz:2283',
      'hub.farcaster.standardcrypto.vc:2283',
    ];

    let submitted = false;
    let lastError: Error | null = null;

    for (const hubUrl of hubUrls) {
      try {
        const hubClient = getSSLHubRpcClient(hubUrl);
        const result = await hubClient.submitMessage(reactionAdd.value);

        if (result.isOk()) {
          submitted = true;
          hubClient.close();
          break;
        } else {
          lastError = new Error(`Hub ${hubUrl} rejected: ${result.error}`);
        }
        hubClient.close();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to submit to hub ${hubUrl}:`, error);
      }
    }

    if (!submitted) {
      throw lastError || new Error('Failed to submit like to any hub');
    }
  } catch (error) {
    console.error('Error performing like:', error);
    throw error;
  }
}

async function performRecast(castHash: string, privateKey: string, signerFid: string, targetFid: number) {
  try {
    // Convert the cast hash from hex string to bytes
    const targetHash = hexToBytes(castHash.startsWith('0x') ? castHash.slice(2) : castHash);

    // Convert private key from hex string to bytes
    const privateKeyBytes = hexToBytes(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey);

    // Create the reaction add message for recast
    const reactionAdd = await makeReactionAdd(
      {
        type: ReactionType.RECAST,
        targetCastId: {
          hash: targetHash,
          fid: BigInt(targetFid),
        },
      },
      { fid: Number(signerFid), network: FarcasterNetwork.MAINNET },
      privateKeyBytes
    );

    if (reactionAdd.isErr()) {
      throw new Error(`Failed to create recast: ${reactionAdd.error}`);
    }

    // Submit to Farcaster hub with fallback options
    const hubUrls = [
      'hub-grpc.pinata.cloud',
      'nemes.farcaster.xyz:2283',
      'hoyt.farcaster.xyz:2283',
      'hub.farcaster.standardcrypto.vc:2283',
    ];

    let submitted = false;
    let lastError: Error | null = null;

    for (const hubUrl of hubUrls) {
      try {
        const hubClient = getSSLHubRpcClient(hubUrl);
        const result = await hubClient.submitMessage(reactionAdd.value);

        if (result.isOk()) {
          submitted = true;
          hubClient.close();
          break;
        } else {
          lastError = new Error(`Hub ${hubUrl} rejected: ${result.error}`);
        }
        hubClient.close();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to submit to hub ${hubUrl}:`, error);
      }
    }

    if (!submitted) {
      throw lastError || new Error('Failed to submit recast to any hub');
    }
  } catch (error) {
    console.error('Error performing recast:', error);
    throw error;
  }
}
