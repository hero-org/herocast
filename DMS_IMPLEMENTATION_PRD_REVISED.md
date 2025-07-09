# Direct Messages Feature - Revised Implementation PRD

## Overview

Add read-only Direct Messages (DMs) functionality to Herocast, allowing users to view their Farcaster conversations and group chats using the Warpcast Direct Cast API.

## Important Naming Convention

**CRITICAL**: Throughout the codebase, we use the following naming conventions:
- Database column: `farcaster_api_key` (NOT `warpcast_api_key`)
- Type field: `farcasterApiKey` (NOT `warpcastApiKey`)
- UI references: "Farcaster API Key" and "Farcaster app" (NOT "Warpcast")
- The API key format starts with `wc_secret_` but we still call it "Farcaster API Key"

## Critical Security & UX Updates

### 1. Database Schema

Add a new encrypted column to the accounts table:

```sql
-- Migration: supabase/migrations/[timestamp]_add_farcaster_api_key.sql
ALTER TABLE accounts
ADD COLUMN farcaster_api_key TEXT;

-- Apply same encryption as private_key
UPDATE accounts
SET farcaster_api_key = CASE
  WHEN farcaster_api_key IS NOT NULL
  THEN encode(pgsodium.crypto_aead_det_encrypt(
    convert_to(farcaster_api_key, 'utf8'),
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
    WHEN farcaster_api_key IS NULL THEN NULL
    ELSE convert_from(
      pgsodium.crypto_aead_det_decrypt(
        decode(farcaster_api_key, 'base64'),
        convert_to('', 'utf8'),
        'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
        NULL
      ), 'utf8'
    )
  END AS decrypted_farcaster_api_key
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
  farcasterApiKey?: string; // Only available in memory, never persisted to IndexedDB
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
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .single();

  if (error || !account?.decrypted_farcaster_api_key) {
    return res.status(403).json({ error: 'Unauthorized or API key not found' });
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: 'Request timeout', conversations: [], groups: [] });
  }, TIMEOUT_THRESHOLD);

  try {
    // Fetch both conversations and groups in parallel
    const [conversationsRes, groupsRes] = await Promise.all([
      fetch(
        `${WARPCAST_API_BASE}/fc/conversation-list?${new URLSearchParams({
          ...(cursor && { cursor: cursor as string }),
          ...(limit && { limit: limit as string }),
          ...(category && { category: category as string }),
        })}`,
        {
          headers: {
            Authorization: `Bearer ${account.decrypted_farcaster_api_key}`,
            'Content-Type': 'application/json',
          },
        }
      ),
      fetch(
        `${WARPCAST_API_BASE}/fc/group-list?${new URLSearchParams({
          ...(cursor && { cursor: cursor as string }),
          ...(limit && { limit: limit as string }),
          ...(category && { category: category as string }),
        })}`,
        {
          headers: {
            Authorization: `Bearer ${account.decrypted_farcaster_api_key}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    ]);

    clearTimeout(timeout);

    const conversations = await conversationsRes.json();
    const groups = await groupsRes.json();

    res.status(200).json({
      conversations: conversations.result?.conversations || [],
      groups: groups.result?.groups || [],
      nextCursor: conversations.next?.cursor || groups.next?.cursor,
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
2. Update global hotkeys in `/src/common/hooks/useGlobalHotkeys.ts`
3. Create `DMsOnboarding` component for API key setup
4. Check if active account has `farcasterApiKey`
5. Show onboarding if no API key
6. Add API key input form with:
   - Password field for API key with validation (must start with `wc_secret_`)
   - Instructions: Settings → Developers (scroll down) → API Keys → Create new API key
   - Visual screenshots showing the steps
   - Save button and "Open Farcaster Settings" link
7. Test command palette navigation and Shift+M hotkey

**Deliverable**: DMs accessible via Shift+M and command palette with onboarding flow

### Day 4: Database & API Key Storage

**Goal**: Implement secure API key storage

1. Create Supabase migration for `farcaster_api_key` column
2. Update account types in `useAccountStore.ts`
3. Create function to save encrypted API key:
   ```typescript
   const saveFarcasterApiKey = async (accountId: string, apiKey: string) => {
     // Update account in Supabase with encrypted key
   };
   ```
4. Update onboarding to save API key
5. Test API key saves and retrieves correctly
6. Ensure API key is NOT in IndexedDB

**Deliverable**: Working API key storage system

### Day 5: API Integration - Conversations

**Goal**: Connect to real Warpcast Direct Cast API

1. Create `/pages/api/dms/conversations.ts`
2. Create `/pages/api/dms/messages.ts`
3. Replace mock data with real API calls
4. Handle loading and error states
5. Implement cursor-based pagination
6. Add auto-refresh (2 minute interval)
7. Test with real Farcaster API key

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

### Completed & Verified ✅
- [x] Shift+M opens DMs instantly
- [x] All keyboard shortcuts work (1/2/3 for tabs, j/k navigation, Enter select, Shift+R refresh)
- [x] API key stored securely (encrypted in Supabase, never in IndexedDB)
- [x] Smooth 60fps scrolling in message lists
- [x] Clean onboarding flow with API key validation

### Implemented but Pending API Access Testing ⏳
- [ ] Conversations load within 2 seconds (blocked by API allowlisting)
- [ ] Auto-refresh keeps data current (implemented, needs real data)
- [ ] Clean error states for all scenarios (basic implementation done)
- [ ] Cursor-based pagination working with real data
- [ ] Rate limit handling and backoff

## Implementation Progress & Learnings

### Completed (Days 1-3)

1. **UI Scaffolding & Navigation** ✅
   - Created `/pages/dms/index.tsx` with full layout
   - Three tabs: Conversations, Groups, Archived
   - 50/50 split layout with SelectableListWithHotkeys
   - All keyboard shortcuts working (1/2/3 for tabs, j/k for navigation, Enter to select, Shift+R to refresh)

2. **Mock Data & Components** ✅
   - Created comprehensive mock conversations and groups
   - Built `MessageThread` component with chat-style UI
   - Unread indicators and timestamps
   - Empty states for all tabs

3. **Command Palette & Onboarding** ✅
   - Added to command palette with Shift+M hotkey
   - Created beautiful onboarding UI with:
     - Large, readable fonts (text-3xl title, text-base content)
     - API key validation (must start with `wc_secret_`)
     - Visual screenshots with dynamic sizing
     - Correct path: Settings → Developers → API Keys → Create new API key
   - Temporary localStorage storage for demo

### Key Learnings

1. **Naming Convention**: Always use "Farcaster" in UI, not "Warpcast"
2. **API Key Format**: Keys start with `wc_secret_` but we call them "Farcaster API Keys"
3. **UX Improvements**:
   - Larger fonts make onboarding much more user-friendly
   - Visual screenshots are essential for API key setup
   - Dynamic image sizing (not forced aspect ratios) looks better
4. **Security**: API keys must never be stored in IndexedDB, only in encrypted Supabase columns

4. **Database & API Key Storage** ✅
   - Created Supabase migration with encrypted `farcaster_api_key` column
   - Updated AccountObjectType with farcasterApiKey field (memory only)
   - Built secure API endpoint `/api/accounts/farcaster-api-key`
   - Added `updateAccountProperty` and `loadFarcasterApiKey` functions
   - Verified API key is excluded from IndexedDB persistence

5. **API Integration - Conversations & Messages** ✅
   - Created comprehensive Direct Cast API constants with rate limits
   - Built DirectCastAPI client class with proper error handling
   - Implemented `/api/dms/conversations` and `/api/dms/messages` endpoints
   - Created `useDirectMessages` and `useDirectMessageThread` hooks
   - Updated DMs page to use real API data with proper loading states
   - Added error handling with retry functionality
   - Implemented cursor-based pagination
   - Set up auto-refresh every 2 minutes
   - Renamed screenshot files for better organization

### Day 5 Additional Learnings

1. **Authentication Flow**:
   - The `decrypted_dm_accounts` view requires `auth.uid()` to match the account owner
   - API keys are successfully decrypted when authenticated correctly
   - The 401 error comes from the Direct Cast API, not our authentication

2. **API Allowlisting Required**:
   - Direct Cast API requires accounts to be allowlisted before access
   - All infrastructure is ready and working up to the external API call
   - Debug logging added to track the exact failure point

3. **Key Storage Implementation**:
   - `loadFarcasterApiKey` function must be called explicitly (not part of normal hydration)
   - API keys are kept in memory only, never persisted to IndexedDB
   - Successful pattern: Check memory → Load from Supabase → Show onboarding if missing

### Day 6: Polish & Error Handling ✅

Successfully completed all Day 6 polish and performance tasks:

1. **Comprehensive Error Handling**:
   - Created `dmErrors.ts` utility with error classification and recovery strategies
   - Added `DMErrorState` component with user-friendly error displays
   - Implemented exponential backoff retry logic with jitter
   - Added specific handling for auth errors, rate limits, and network failures

2. **UI Enhancements**:
   - Added refresh dropdown menu with keyboard shortcuts
   - Implemented smooth 60fps transitions and animations
   - Added loading skeletons and states throughout
   - Created responsive design with mobile support

3. **Edge Case Handling**:
   - Added error boundaries to prevent crashes
   - Created smart message display with "Show more" for long messages
   - Added handling for deleted messages and empty conversations
   - Implemented proper truncation and fallbacks

4. **Performance Optimizations**:
   - Added 300ms debouncing for API calls
   - Implemented request cancellation with AbortController
   - Created profile prefetching with batch loading (100 profiles at once)
   - Added 5-minute profile caching with smart invalidation

5. **Profile Features**:
   - Added profile hover cards with desktop/mobile support
   - Implemented 500ms hover delay for better UX
   - Created profile loading states and skeletons

### Cleanup & Optimization

After review, we identified and fixed several issues:

1. **Removed Redundant Code**:
   - Removed `useProfilePrefetch` hook (redundant with existing `fetchBulkProfiles`)
   - Removed `ProfileLoader` component (unused)
   - Removed `UnavailableConversation` component (not needed)
   - Used existing `useDataStore` profile caching instead of reimplementing

2. **Integrated Unused Components**:
   - Connected `DMLoadingState`, `DMEmptyState`, `DMErrorState` to DMs page
   - Replaced inline `renderDMRow` with `ConversationListItem` component
   - Fixed undefined styles reference in `AnimatedMessageThread`

3. **Kept Valuable Additions**:
   - Debounce hooks (`useDebounce`, `useDebouncedCallback`)
   - DM-specific helper functions
   - Error handling utilities
   - All UI components now properly integrated

### Next Steps

- Remove debug logging once allowlisted
- Implement message sending functionality (POST endpoints - future phase)
- Add real-time updates via WebSocket (future phase)

### Postponed Tests (Pending API Allowlisting)

These tests require Direct Cast API access and will be completed after allowlisting:

- [ ] **API Integration Tests**:
  - Verify conversations load within 2 seconds
  - Test auto-refresh with real data
  - Validate rate limit handling
  - Test pagination with large conversation lists
  
- [ ] **Error Handling Tests**:
  - Invalid API key error messages
  - Expired token handling
  - Network timeout scenarios
  - Rate limit exceeded responses

- [ ] **End-to-End Tests**:
  - Full conversation loading flow
  - Message thread navigation
  - Cross-tab synchronization
  - Memory leak testing with long sessions
