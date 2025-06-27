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

  console.log(`[List ${list.id}] Starting processing:`, {
    name: list.name,
    feedSource: content.feedSource || 'specific_users',
    fidsCount: content.fids?.length || 0,
    actionType: content.actionType,
    lastProcessedHash: content.lastProcessedHash || 'none',
    filters: {
      onlyTopCasts: content.onlyTopCasts,
      requireMentions: content.requireMentions || [],
      requiredUrls: content.requiredUrls || [],
      requiredKeywords: content.requiredKeywords || [],
    },
    listCreatedAt: list.created_at,
  });

  if (!content.fids || content.fids.length === 0) {
    console.log(`[List ${list.id}] No FIDs to monitor, skipping`);
    return;
  }

  // Note: We'll get the account details from decrypted_accounts view below

  // Get decrypted account data directly from the view (like publish-cast-from-db does)
  const { data: accounts, error: decryptError } = await supabase
    .from('decrypted_accounts')
    .select('id, platform_account_id, decrypted_private_key')
    .eq('id', content.sourceAccountId);

  if (decryptError || !accounts || accounts.length === 0) {
    throw new Error(`Failed to get decrypted account: ${decryptError?.message || 'Account not found'}`);
  }

  const account = accounts[0];
  const privateKey = account.decrypted_private_key;

  console.log(`[List ${list.id}] Decrypted account:`, {
    hasAccount: !!account,
    hasPrivateKey: !!privateKey,
    accountId: content.sourceAccountId,
    platformAccountId: account.platform_account_id,
  });

  if (!privateKey) {
    throw new Error(`No private key found for account ${content.sourceAccountId}`);
  }

  // Fetch recent casts based on feed source
  console.log(`[List ${list.id}] Fetching casts...`);
  const casts = await fetchAllRecentCasts(
    content.feedSource === 'following' ? account.platform_account_id : null,
    content.feedSource === 'following' ? [] : content.fids,
    content.lastProcessedHash,
    list.created_at
  );
  console.log(`[List ${list.id}] Found ${casts.length} total casts to process`);

  let processedCount = 0;
  let lastHash = content.lastProcessedHash;

  let filteredOutCount = 0;
  let duplicateCount = 0;

  // First, filter casts and collect hashes
  const castsToProcess = [];
  const castHashes = [];

  for (const cast of casts) {
    // Apply filters
    if (!shouldProcessCast(cast, content, account.platform_account_id)) {
      filteredOutCount++;
      continue;
    }

    castsToProcess.push(cast);
    castHashes.push(cast.hash);
  }

  console.log(
    `[List ${list.id}] Filtered ${castsToProcess.length} casts from ${casts.length} total (${filteredOutCount} filtered out)`
  );

  // Batch query to check which casts have already been processed
  let processedCastHashes = new Set<string>();
  if (castHashes.length > 0) {
    const { data: existingHistory } = await supabase
      .from('auto_interaction_history')
      .select('cast_hash')
      .eq('list_id', list.id)
      .in('cast_hash', castHashes);

    if (existingHistory && existingHistory.length > 0) {
      processedCastHashes = new Set(existingHistory.map((h: any) => h.cast_hash));
      console.log(`[List ${list.id}] Found ${processedCastHashes.size} already processed casts`);
    }
  }

  // Now process each cast
  for (const cast of castsToProcess) {
    // Check if already processed using O(1) Set lookup
    if (processedCastHashes.has(cast.hash)) {
      console.log(`[List ${list.id}] Cast ${cast.hash} already processed, skipping`);
      duplicateCount++;
      continue;
    }

    console.log(`[List ${list.id}] Processing cast:`, {
      hash: cast.hash,
      author: cast.author.username || cast.author.fid,
      text: cast.text?.substring(0, 100) + '...',
      isReply: !!cast.parent_hash,
    });

    // Perform the actions
    const actions = [];
    if (content.actionType === 'like' || content.actionType === 'both') {
      actions.push({
        type: 'like',
        action: () => submitReaction('like', cast, privateKey, account.platform_account_id),
      });
    }
    if (content.actionType === 'recast' || content.actionType === 'both') {
      actions.push({
        type: 'recast',
        action: () => submitReaction('recast', cast, privateKey, account.platform_account_id),
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
  if (casts.length > 0 && casts[0].hash !== content.lastProcessedHash) {
    // Always update to the newest cast we saw (first in the array)
    const updatedContent = {
      ...content,
      lastProcessedHash: casts[0].hash,
    };
    await supabase.from('list').update({ contents: updatedContent }).eq('id', list.id);
    console.log(`[List ${list.id}] Updated lastProcessedHash to ${casts[0].hash}`);
  }

  console.log(`[List ${list.id}] Summary:`, {
    totalCastsFetched: casts.length,
    filteredOut: filteredOutCount,
    duplicatesSkipped: duplicateCount,
    actionsPerformed: processedCount,
    lastProcessedHash: lastHash,
  });
}

function shouldProcessCast(cast: any, content: AutoInteractionListContent, actingAccountFid: string): boolean {
  const logPrefix = `  [${cast.hash.substring(0, 10)}...] @${cast.author.username || cast.author.fid}:`;

  // Check if cast is from the acting account itself
  if (cast.author.fid.toString() === actingAccountFid) {
    console.log(`${logPrefix} ❌ Filtered: Self-cast (acting account)`);
    return false;
  }

  // Check if it's a top-level cast
  if (content.onlyTopCasts && cast.parent_hash) {
    console.log(`${logPrefix} ❌ Filtered: Is a reply`);
    return false;
  }

  // Check mention requirements
  if (content.requireMentions && content.requireMentions.length > 0) {
    const mentionedFids = extractMentionedFids(cast);
    const hasRequiredMention = content.requireMentions.some((fid) => mentionedFids.includes(fid));
    if (!hasRequiredMention) {
      console.log(
        `${logPrefix} ❌ Filtered: Missing mentions. Required: [${content.requireMentions}], Found: [${mentionedFids}]`
      );
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
      console.log(`${logPrefix} ❌ Filtered: Missing URLs. Required: [${content.requiredUrls}], Found: [${castUrls}]`);
      return false;
    }
  }

  // Check keyword requirements
  if (content.requiredKeywords && content.requiredKeywords.length > 0) {
    const castText = cast.text?.toLowerCase() || '';
    const hasRequiredKeyword = content.requiredKeywords.some((keyword) => castText.includes(keyword.toLowerCase()));
    if (!hasRequiredKeyword) {
      console.log(`${logPrefix} ❌ Filtered: Missing keywords. Required: [${content.requiredKeywords}]`);
      console.log(`    Full text: "${cast.text}"`);
      return false;
    }
  }

  console.log(`${logPrefix} ✅ Passed all filters`);
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

async function fetchAllRecentCasts(
  followingFid: string | null,
  specificFids: string[],
  lastProcessedHash?: string,
  listCreatedAt?: string
): Promise<any[]> {
  const allCasts: any[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = 5; // Reduced to prevent timeouts - Supabase functions have limited execution time

  // For first run, only process casts created after the list was created
  // Add 5 minute grace period for testing
  const graceMinutes = 5;
  const listCreationTime = listCreatedAt ? new Date(listCreatedAt).getTime() - graceMinutes * 60 * 1000 : 0;

  console.log(`Fetching casts:`, {
    followingFid,
    specificFids: specificFids.length > 0 ? specificFids : 'none',
    lastProcessedHash: lastProcessedHash || 'none (first run)',
    listCreatedAt: listCreatedAt || 'none',
    effectiveStartTime: listCreationTime ? new Date(listCreationTime).toISOString() : 'none',
    graceMinutes: !lastProcessedHash ? graceMinutes : 0,
  });

  while (pageCount < maxPages) {
    let url: string;

    if (followingFid) {
      // Fetch following feed
      url = `https://api.neynar.com/v2/farcaster/feed?feed_type=following&fid=${followingFid}&limit=100`;
    } else if (specificFids.length > 0) {
      // Fetch specific users' casts (max 100 FIDs allowed by Neynar)
      const fidsToUse = specificFids.slice(0, 100);
      url = `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fidsToUse.join(',')}&limit=100`;
    } else {
      // No valid feed source
      console.log('No valid feed source provided');
      return [];
    }

    // Add cursor for pagination
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
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
    const pageCasts = data.casts || [];
    cursor = data.next?.cursor;

    pageCount++;
    console.log(`  Page ${pageCount}: fetched ${pageCasts.length} casts`);

    // Process this page of casts
    let foundLastProcessed = false;
    for (const cast of pageCasts) {
      // Check if we've reached the last processed cast
      if (lastProcessedHash && cast.hash === lastProcessedHash) {
        foundLastProcessed = true;
        break;
      }

      // For first run, skip casts older than list creation
      if (!lastProcessedHash && listCreationTime && cast.timestamp) {
        const castTime = new Date(cast.timestamp).getTime();
        if (castTime < listCreationTime) {
          // Log more details for debugging specific users
          if (cast.author?.username === 'hellno' || cast.text?.includes('vibes.engineering')) {
            console.log(`  ⚠️  Skipping potentially matching cast:`, {
              hash: cast.hash,
              author: cast.author?.username,
              time: cast.timestamp,
              text: cast.text?.substring(0, 100),
              listCreated: new Date(listCreationTime).toISOString(),
            });
          } else {
            console.log(`  Skipping cast older than list creation: ${cast.hash}`);
          }
          continue;
        }
      }

      // Log casts from specific users for debugging
      if (cast.author?.username === 'hellno' || cast.text?.includes('vibes.engineering')) {
        console.log(`  📍 Found cast of interest:`, {
          hash: cast.hash,
          author: cast.author?.username,
          time: cast.timestamp,
          text: cast.text,
        });
      }

      allCasts.push(cast);
    }

    // Stop conditions
    if (foundLastProcessed) {
      console.log(`  Found last processed hash, stopping pagination`);
      break;
    }

    if (!cursor) {
      console.log(`  No more pages available`);
      break;
    }

    // Limit total casts to prevent timeouts
    if (allCasts.length >= 200) {
      console.log(`  Reached maximum cast limit (200) to prevent timeout`);
      break;
    }

    // For first run, don't paginate too far back
    if (!lastProcessedHash && allCasts.length >= 100) {
      console.log(`  First run: limiting to 100 casts`);
      break;
    }
  }

  console.log(`Total casts fetched across ${pageCount} pages: ${allCasts.length}`);
  return allCasts;
}

async function submitReaction(type: 'like' | 'recast', cast: any, privateKey: string, authorFid: string) {
  if (!privateKey) {
    throw new Error('Private key is required to submit reactions');
  }

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
    type: type as 'like' | 'recast',
    target: {
      fid: cast.author.fid,
      hash: cast.hash,
    },
  };

  await writeClient.submitReaction(reaction, Number(authorFid), cleanPrivateKey);
  console.log(`Successfully submitted ${type} for cast ${cast.hash}`);
}
