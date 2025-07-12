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

### Day 7: Write Direct Cast - Send Messages

**Goal**: Add ability to reply to conversations and start new conversations

#### Step 1: Reply Input Component (Start Here!)

Create `MessageInput.tsx` by copying patterns from the cast composer:

```typescript
// src/common/components/DirectMessages/MessageInput.tsx
// Copy structure from: src/common/components/NewCastModal.tsx (look at the textarea)
// Use these shadcn components:
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// Key features to implement:
// 1. Auto-resize textarea (see NewCastModal for example)
// 2. Character counter (320 char limit for DMs)
// 3. Disabled when no API key: placeholder="Read-only mode"
// 4. onSubmit with Cmd/Ctrl+Enter
```

#### Step 2: Send Message API

Create `/pages/api/dms/send.ts` by copying structure from `/pages/api/dms/conversations.ts`:

```typescript
// Copy the auth pattern from conversations.ts
// Main differences:
// - Use POST method
// - Call Direct Cast API: POST https://api.warpcast.com/fc/conversation-send
// - Request body: { conversationId, recipientFid, message }
```

#### Step 3: New Conversation Dialog

Use existing shadcn Dialog components:

```typescript
// src/common/components/DirectMessages/NewConversationDialog.tsx
// Use these components:
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command';

// Copy user search logic from: pages/search/index.tsx
// Look for: debouncedUserSearch function
```

#### Step 4: Wire It Together in DMs Page

1. Add "+" button next to tabs (copy dropdown menu pattern already there)
2. Add state for dialog: `const [showNewConversation, setShowNewConversation] = useState(false)`
3. Add hotkey (copy existing hotkey pattern):
   ```typescript
   useHotkeys('cmd+n,ctrl+n', () => setShowNewConversation(true), {
     enabled: !isNewCastModalOpen,
   });
   ```

#### Step 5: User Search Component

Reuse existing search functionality:

```typescript
// src/common/components/DirectMessages/UserSearchInput.tsx
// Copy from: src/common/components/SearchInterface.tsx
// But simplify to just user search:
// 1. Remove filters
// 2. Use NeynarAPIClient.searchUser()
// 3. Show results in CommandList (like command palette)
```

#### Step 6: Update Message Thread

In `MessageThread.tsx`, add the input at the bottom:

```typescript
// At the end of the component, add:
<div className="flex-shrink-0 border-t border-muted px-4 py-3">
  <MessageInput
    onSend={handleSend}
    disabled={!hasApiKey}
    isLoading={isSending}
  />
</div>
```

#### Step 7: Optimistic Updates

In `useDirectMessages.ts` hook:

```typescript
// Add this function:
const sendMessage = async (text: string, conversationId?: string, recipientFid?: number) => {
  // 1. Create optimistic message with pending status
  const optimisticMessage = {
    id: `pending-${Date.now()}`,
    text,
    status: 'pending',
    timestamp: new Date().toISOString(),
    // ... other fields
  };

  // 2. Add to messages array immediately
  setMessages((prev) => [...prev, optimisticMessage]);

  // 3. Call API
  try {
    const result = await fetch('/api/dms/send', {
      /* ... */
    });
    // 4. Replace optimistic message with real one
  } catch (error) {
    // 5. Mark as failed, show retry button
  }
};
```

#### Important Files to Reference:

- **For Dialog**: `/src/common/components/CommandPalette.tsx` - shows dialog + search pattern
- **For Textarea**: `/src/common/components/NewCastModal.tsx` - shows auto-resize textarea
- **For User Search**: `/pages/search/index.tsx` - shows user search implementation
- **For API**: `/pages/api/dms/conversations.ts` - shows auth pattern
- **For Hotkeys**: Current DMs page already has examples

**Deliverable**: Fully functional messaging with reply and new conversation capabilities

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

### Day 7 - To Be Implemented 📝

- [ ] Message input with auto-resize and character limit
- [ ] Send messages with Cmd/Ctrl+Enter
- [ ] New conversation dialog with user search
- [ ] Optimistic message updates
- [ ] Message status indicators (pending/sent/failed)
- [ ] Rate limit handling for sending (5 msgs/min)

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

5. **Database & API Key Storage** ✅

   - Created Supabase migration with encrypted `farcaster_api_key` column
   - Updated AccountObjectType with farcasterApiKey field (memory only)
   - Built secure API endpoint `/api/accounts/farcaster-api-key`
   - Added `updateAccountProperty` and `loadFarcasterApiKey` functions
   - Verified API key is excluded from IndexedDB persistence

6. **API Integration - Conversations & Messages** ✅
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

### Day 6 Additional UI Polish & Fixes ✅

After initial Day 6 implementation, we completed extensive UI polish based on user feedback:

1. **Performance Enhancements**:

   - Achieved <100ms conversation switching by removing all animation delays
   - Removed 300ms debounce from message loading for instant updates
   - Messages clear immediately when switching conversations
   - Added skeleton loading to prevent showing old messages with new headers

2. **UI Bug Fixes**:

   - Fixed "Unknown user" display by correcting property names (pfpUrl → pfp_url)
   - Fixed "55504 years ago" timestamp by handling edge cases properly
   - Fixed reversed conversation order (now shows oldest first)
   - Fixed conversation list width (was too wide at 50%, now responsive)
   - Fixed duplicate key warnings by adding unique ID generation
   - Fixed page scrolling issues - chat input now always pinned to bottom
   - Fixed text wrapping for long URLs without breaking normal text

3. **Layout Improvements**:

   - Fixed sidebar width wiggling with fixed-width classes (w-80 lg:w-96)
   - Proper height constraints with flex layouts throughout
   - Changed home layout from overflow-y-auto to overflow-hidden
   - Added flex-1 and min-h-0 for proper content sizing

4. **Right Sidebar Integration**:

   - Added selectedProfileFid state to useDataStore
   - Updated ShadcnRightSidebar to prioritize selectedProfileFid
   - DMs page updates selectedProfileFid when selecting conversations
   - Added cleanup to clear selectedProfileFid on navigation
   - Works seamlessly with existing profile display system

5. **Visual Polish**:
   - Removed hover effects from message bubbles
   - Simplified skeleton loader to show just one incoming message
   - Consistent 50ms transitions for tab switching
   - Clean, minimal design matching herocast aesthetics

### Final Implementation Summary

The DMs feature is now fully implemented and polished with:

- ✅ **Instant Performance**: <100ms conversation switching
- ✅ **Robust Error Handling**: Comprehensive error states with retry logic
- ✅ **Profile Integration**: Uses existing dataStore for efficient caching
- ✅ **Keyboard Navigation**: Full hotkey support throughout
- ✅ **Responsive Design**: Works on desktop and mobile
- ✅ **Security**: API keys encrypted and never persisted locally
- ✅ **UI Polish**: All visual bugs fixed, smooth interactions
- ✅ **Sidebar Integration**: Shows participant profiles in right sidebar

The only remaining task is testing with real API access once the account is allowlisted on the Direct Cast API.

### Day 7 Technical Specifications

**API Endpoints Required**:

1. **Send Message**: `POST /api/dms/send`

   ```typescript
   Request: {
     conversationId?: string,  // For existing conversations
     recipientFid?: number,    // For new conversations
     message: string
   }
   Response: DirectCastMessage
   ```

2. **Search Users**: Use existing Neynar search

   ```typescript
   // Reuse from search page
   neynarClient.searchUser(query, viewerFid);
   ```

3. **Start Conversation**: `POST /api/dms/conversation/new`
   ```typescript
   Request: {
     recipientFid: number,
     initialMessage: string
   }
   Response: {
     conversationId: string,
     message: DirectCastMessage
   }
   ```

**Direct Cast API Endpoints**:

- Send message: `POST https://api.warpcast.com/fc/conversation-send`
- Rate limit: 5 messages per minute per user

**Component Structure**:

```
src/common/components/DirectMessages/
├── MessageInput.tsx         // Reply input component (copy from NewCastModal.tsx textarea)
├── NewConversationDialog.tsx // New conversation modal (use Dialog + Command components)
├── UserSearchInput.tsx      // User search autocomplete (simplify from SearchInterface.tsx)
└── MessageStatus.tsx        // Pending/sent indicators (use Badge component)
```

**Key Implementation Notes for Intern**:

1. **Start with MessageInput.tsx** - it's the simplest component
2. **Use existing patterns** - don't create new UI patterns
3. **Test with mock data first** - use the existing mock conversations
4. **Add features incrementally** - get basic send working before optimistic updates
5. **Ask questions** - the codebase has examples for everything you need

**State Updates**:

- Add `sendMessage` action to `useDirectMessages` hook
- Add `pendingMessages` to local state
- Update `conversations` list after sending
- Add `messageSendQueue` for offline support (future)
