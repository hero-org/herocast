# Direct Messages Feature - Revised Implementation PRD

## Overview
Add read-only Direct Messages (DMs) functionality to Herocast, allowing users to view their Farcaster conversations and group chats using the Warpcast Direct Cast API.

## Critical Security & UX Updates

### 1. Database Schema

Add a new encrypted column to the accounts table:

```sql
-- Migration: supabase/migrations/[timestamp]_add_warpcast_api_key.sql
ALTER TABLE accounts 
ADD COLUMN warpcast_api_key TEXT;

-- Apply same encryption as private_key
UPDATE accounts 
SET warpcast_api_key = CASE 
  WHEN warpcast_api_key IS NOT NULL 
  THEN encode(pgsodium.crypto_aead_det_encrypt(
    convert_to(warpcast_api_key, 'utf8'),
    convert_to('', 'utf8'),
    'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
    NULL
  ), 'base64')
  ELSE NULL
END;

-- Create secure view for decryption
CREATE OR REPLACE VIEW decrypted_dm_accounts AS
SELECT 
  id,
  user_id,
  platform_account_id,
  CASE
    WHEN warpcast_api_key IS NULL THEN NULL
    ELSE convert_from(
      pgsodium.crypto_aead_det_decrypt(
        decode(warpcast_api_key, 'base64'),
        convert_to('', 'utf8'),
        'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
        NULL
      ), 'utf8'
    )
  END AS decrypted_warpcast_api_key
FROM accounts
WHERE accounts.user_id = auth.uid();

-- Apply RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON decrypted_dm_accounts TO authenticated;
```

### 2. Type Updates

```typescript
// In src/stores/useAccountStore.ts
type AccountObjectType = {
  // ... existing fields
  warpcastApiKey?: string; // Only available in memory, never persisted
};
```

### 3. Secure API Routes

Create `/pages/api/dms/conversations.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export const config = { maxDuration: 20 };

const WARPCAST_API_BASE = 'https://api.warpcast.com';
const TIMEOUT_THRESHOLD = 19000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountId, cursor, limit = 25, category } = req.query;
  
  if (!accountId) {
    return res.status(400).json({ error: 'Missing accountId' });
  }

  // Create authenticated Supabase client
  const supabase = createPagesServerClient({ req, res });
  
  // Verify user owns this account and get API key
  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_warpcast_api_key')
    .eq('id', accountId)
    .single();
    
  if (error || !account?.decrypted_warpcast_api_key) {
    return res.status(403).json({ error: 'Unauthorized or API key not found' });
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: 'Request timeout', conversations: [], groups: [] });
  }, TIMEOUT_THRESHOLD);

  try {
    // Fetch both conversations and groups in parallel
    const [conversationsRes, groupsRes] = await Promise.all([
      fetch(`${WARPCAST_API_BASE}/fc/conversation-list?${new URLSearchParams({
        ...(cursor && { cursor: cursor as string }),
        ...(limit && { limit: limit as string }),
        ...(category && { category: category as string }),
      })}`, {
        headers: {
          'Authorization': `Bearer ${account.decrypted_warpcast_api_key}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`${WARPCAST_API_BASE}/fc/group-list?${new URLSearchParams({
        ...(cursor && { cursor: cursor as string }),
        ...(limit && { limit: limit as string }),
        ...(category && { category: category as string }),
      })}`, {
        headers: {
          'Authorization': `Bearer ${account.decrypted_warpcast_api_key}`,
          'Content-Type': 'application/json',
        },
      })
    ]);

    clearTimeout(timeout);

    const conversations = await conversationsRes.json();
    const groups = await groupsRes.json();

    res.status(200).json({ 
      conversations: conversations.result?.conversations || [],
      groups: groups.result?.groups || [],
      nextCursor: conversations.next?.cursor || groups.next?.cursor
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('Error fetching DMs:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}
```

### 4. UI Structure (Following Notifications Pattern)

Create `/pages/dms/index.tsx`:
```typescript
// Key structure elements:
// 1. Tabs for Conversations | Groups | Archived
// 2. Left panel: Chat list with unread indicators
// 3. Right panel: Message thread
// 4. Dropdown menu for actions (refresh, mark read, etc.)
// 5. Auto-refresh every 2 minutes
// 6. Keyboard navigation throughout
```

### 5. Updated Keyboard Shortcut

Add to `/src/getNavigationCommands.ts`:
```typescript
{
  id: NAVIGATION_COMMANDS.DIRECT_MESSAGES,
  name: 'Direct Messages',
  shortcut: ['shift', 'm'], // Changed from 'd' to avoid conflict
  action: () => router.push('/dms'),
  aliases: ['dms', 'messages', 'chats', 'direct', 'dm'],
  options: {
    enableOnContentEditable: false,
    enabled: currentRoute !== '/dms'
  }
}
```

## Daily Task Breakdown for Junior Developer

### Day 1: UI Scaffolding & Navigation
**Goal**: Create the DMs page structure with working keyboard navigation

1. Create `/pages/dms/index.tsx` with basic layout
2. Copy structure from `/pages/inbox/index.tsx` but simplify
3. Create tabs: "Conversations", "Groups", "Archived"
4. Implement two-panel layout (50/50 split)
5. Add SelectableListWithHotkeys for left panel
6. Add keyboard navigation:
   - `1`, `2`, `3` for tab switching
   - `j/k` or arrows for list navigation
   - `Enter` to select conversation
   - `Shift+R` to refresh
7. Add loading states and skeletons
8. Test all hotkeys work smoothly

**Deliverable**: Empty DMs page with working navigation and tabs

### Day 2: Mock Data & List Components
**Goal**: Build the conversation list UI with mock data

1. Create mock data for conversations and groups
2. Create `DMListItem` component showing:
   - Avatar (or group icon)
   - Name/Group name
   - Last message preview
   - Timestamp
   - Unread indicator (blue dot)
3. Create `MessageThread` component with:
   - Message bubbles
   - Timestamps
   - Sender info
4. Style to match herocast design system
5. Add empty states for each tab

**Deliverable**: Fully styled DMs UI with mock data

### Day 3: Command Palette & Account Integration
**Goal**: Integrate with command palette and account system

1. Add DMs command to `/src/getNavigationCommands.ts`
2. Update command palette to include DMs navigation
3. Create `DMsOnboarding` component for API key setup
4. Check if active account has `warpcastApiKey`
5. Show onboarding if no API key
6. Add API key input form with:
   - Password field for API key
   - Instructions with link to Warpcast
   - Save button
7. Test command palette navigation

**Deliverable**: DMs accessible via Shift+M and command palette

### Day 4: Database & API Key Storage
**Goal**: Implement secure API key storage

1. Create Supabase migration for `warpcast_api_key` column
2. Update account types in `useAccountStore.ts`
3. Create function to save encrypted API key:
   ```typescript
   const saveWarpcastApiKey = async (accountId: string, apiKey: string) => {
     // Update account in Supabase with encrypted key
   }
   ```
4. Update onboarding to save API key
5. Test API key saves and retrieves correctly
6. Ensure API key is NOT in IndexedDB

**Deliverable**: Working API key storage system

### Day 5: API Integration - Conversations
**Goal**: Connect to real Warpcast API

1. Create `/pages/api/dms/conversations.ts`
2. Create `/pages/api/dms/messages.ts`
3. Replace mock data with real API calls
4. Handle loading and error states
5. Implement cursor-based pagination
6. Add auto-refresh (2 minute interval)
7. Test with real Warpcast API key

**Deliverable**: Real conversations loading from API

### Day 6: Polish & Error Handling
**Goal**: Production-ready features

1. Add comprehensive error handling:
   - Invalid API key
   - Network errors
   - Rate limits
2. Add refresh dropdown menu
3. Implement smooth transitions
4. Add profile hover cards
5. Handle edge cases:
   - No conversations
   - Deleted messages
   - Long message text
6. Performance optimization:
   - Debounce API calls
   - Cache user profiles
7. Final testing of all features

**Deliverable**: Production-ready DMs feature

## Success Metrics

- [ ] Shift+M opens DMs instantly
- [ ] All keyboard shortcuts work
- [ ] API key stored securely (encrypted)
- [ ] Conversations load within 2 seconds
- [ ] Auto-refresh keeps data current
- [ ] Clean error states for all scenarios
- [ ] Smooth 60fps scrolling in message lists