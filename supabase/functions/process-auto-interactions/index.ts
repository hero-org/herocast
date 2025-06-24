import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { HubRestAPIClient } from 'npm:@standard-crypto/farcaster-js-hub-rest';
import axios from 'npm:axios';

// console.log("Hello from process-auto-interactions!")

interface AutoInteractionListContent {
  fids: string[];
  displayNames?: Record<string, string>;
  sourceAccountId: string;
  actionType: 'like' | 'recast' | 'both';
  onlyTopCasts: boolean;
  requireMentions?: string[];
  lastProcessedHash?: string;
  // Content filters
  feedSource?: 'specific_users' | 'following';
  requiredUrls?: string[];
  requiredKeywords?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch all auto-interaction lists
    const { data: lists, error: listsError } = await supabase.from('list').select('*').eq('type', 'auto_interaction');

    if (listsError) {
      throw new Error(`Failed to fetch lists: ${listsError.message}`);
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
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { 'Content-Type': 'application/json' },
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

  // Fetch recent casts based on feed source
  const casts = await fetchRecentCasts(
    content.feedSource === 'following' ? sourceAccount.platform_account_id : null,
    content.feedSource === 'following' ? [] : content.fids,
    content.lastProcessedHash
  );
  console.log(`Found ${casts.length} casts to process for list ${list.id}`);

  let processedCount = 0;
  let lastHash = content.lastProcessedHash;

  for (const cast of casts) {
    // Apply filters
    if (!shouldProcessCast(cast, content)) {
      continue;
    }

    // Check if already processed
    const { data: existing } = await supabase
      .from('auto_interaction_history')
      .select('*')
      .eq('list_id', list.id)
      .eq('cast_hash', cast.hash);

    if (existing && existing.length > 0) {
      continue;
    }

    // Perform the actions
    const actions = [];
    if (content.actionType === 'like' || content.actionType === 'both') {
      actions.push({
        type: 'like',
        action: () => submitReaction('like', cast, privateKey, sourceAccount.platform_account_id),
      });
    }
    if (content.actionType === 'recast' || content.actionType === 'both') {
      actions.push({
        type: 'recast',
        action: () => submitReaction('recast', cast, privateKey, sourceAccount.platform_account_id),
      });
    }

    for (const { type, action } of actions) {
      try {
        await action();

        // Record success
        await supabase.from('auto_interaction_history').insert({
          list_id: list.id,
          cast_hash: cast.hash,
          action: type,
          status: 'success',
        });

        processedCount++;
      } catch (error) {
        console.error(`Failed to ${type} cast ${cast.hash}:`, error);

        // Record failure
        await supabase.from('auto_interaction_history').insert({
          list_id: list.id,
          cast_hash: cast.hash,
          action: type,
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    lastHash = cast.hash;
  }

  // Update last processed hash
  if (processedCount > 0 && lastHash !== content.lastProcessedHash) {
    const updatedContent = { ...content, lastProcessedHash: lastHash };
    await supabase.from('list').update({ contents: updatedContent }).eq('id', list.id);
  }

  console.log(`Processed ${processedCount} actions for list ${list.id}`);
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

  // Check URL requirements
  if (content.requiredUrls && content.requiredUrls.length > 0) {
    const castUrls = extractUrlsFromCast(cast);
    const hasRequiredUrl = content.requiredUrls.some((requiredUrl) =>
      castUrls.some((url) => url.includes(requiredUrl))
    );
    if (!hasRequiredUrl) {
      return false;
    }
  }

  // Check keyword requirements
  if (content.requiredKeywords && content.requiredKeywords.length > 0) {
    const castText = cast.text?.toLowerCase() || '';
    const hasRequiredKeyword = content.requiredKeywords.some((keyword) => castText.includes(keyword.toLowerCase()));
    if (!hasRequiredKeyword) {
      return false;
    }
  }

  return true;
}

function extractMentionedFids(cast: any): string[] {
  const fids: string[] = [];

  if (cast.mentioned_profiles) {
    cast.mentioned_profiles.forEach((profile: any) => {
      fids.push(profile.fid.toString());
    });
  }

  if (cast.embeds) {
    cast.embeds.forEach((embed: any) => {
      if (embed.user && embed.user.fid) {
        fids.push(embed.user.fid.toString());
      }
    });
  }

  return fids;
}

function extractUrlsFromCast(cast: any): string[] {
  const urls: string[] = [];

  // Extract URLs from embeds
  if (cast.embeds) {
    cast.embeds.forEach((embed: any) => {
      if (embed.url) {
        urls.push(embed.url);
      }
    });
  }

  // Also extract URLs from text using regex
  if (cast.text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = cast.text.match(urlRegex);
    if (matches) {
      urls.push(...matches);
    }
  }

  return urls;
}

async function fetchRecentCasts(
  followingFid: string | null,
  specificFids: string[],
  lastProcessedHash?: string
): Promise<any[]> {
  let url: string;

  if (followingFid) {
    // Fetch following feed
    url = `https://api.neynar.com/v2/farcaster/feed?feed_type=following&fid=${followingFid}&limit=50`;
  } else if (specificFids.length > 0) {
    // Fetch specific users' casts
    url = `https://api.neynar.com/v2/farcaster/feed?fids=${specificFids.join(',')}&limit=50`;
  } else {
    // No valid feed source
    return [];
  }

  const response = await fetch(url, {
    headers: {
      api_key: Deno.env.get('NEYNAR_API_KEY')!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch casts: ${response.statusText}`);
  }

  const data = await response.json();
  const casts = data.casts || [];

  // Filter out older casts if we have a last processed hash
  if (lastProcessedHash) {
    const lastIndex = casts.findIndex((c: any) => c.hash === lastProcessedHash);
    if (lastIndex >= 0) {
      return casts.slice(0, lastIndex);
    }
  }

  return casts;
}

async function submitReaction(type: 'like' | 'recast', cast: any, privateKey: string, authorFid: string) {
  const axiosInstance = axios.create({
    headers: { api_key: Deno.env.get('NEYNAR_API_KEY') },
  });

  const hubUrl = Deno.env.get('HUB_HTTP_URL') || 'https://snapchain-api.neynar.com';
  const writeClient = new HubRestAPIClient({
    hubUrl,
    axiosInstance,
  });

  // Clean private key format
  let cleanPrivateKey = privateKey;
  if (privateKey.startsWith('0x')) {
    cleanPrivateKey = privateKey.slice(2);
  }

  const reaction = {
    type: type === 'like' ? 1 : 2, // ReactionType enum
    targetCastId: {
      fid: cast.author.fid,
      hash: cast.hash,
    },
  };

  await writeClient.submitReaction(reaction, Number(authorFid), cleanPrivateKey);
  console.log(`Successfully submitted ${type} for cast ${cast.hash}`);
}
