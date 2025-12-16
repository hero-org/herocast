# PRD: Extend Draft Store for Thread Composition

**Issue**: [#668](https://github.com/hero-org/herocast/issues/668)
**Status**: Ready for Implementation
**Dependencies**: #667 (closed - ID-based operations now available)
**Enables**: #666 (Thread composer UI)
**Deferred**: #682 (Scheduled thread publishing)

---

## Summary

Extend `useDraftStore` to support thread drafts (multiple related posts that will be published sequentially). This is a building block for the thread composer UI - **no UI changes in this ticket**.

---

## Current State

### DraftType (`src/common/constants/farcaster.ts:85-100`)

```typescript
export type DraftType = {
  id: UUID;
  text: string;
  status: DraftStatus;
  createdAt: number;
  mentionsToFids?: { [key: string]: string };
  embeds?: FarcasterEmbed[];
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  accountId?: UUID;
  timestamp?: string;
  hash?: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
};
```

### Database Schema (`supabase/migrations/20240612125244_add_scheduled_casts.sql`)

```sql
CREATE TABLE "public"."draft" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "account_id" "uuid" NOT NULL,
    "data" "jsonb",  -- stores: text, embeds, parentUrl, parentCastId
    "status" "text" DEFAULT 'writing'::text,
    "encoded_message_bytes" INTEGER[]  -- pre-encoded for reliable publishing
);
```

### Persistence Strategy

- **SessionStorage**: In-memory drafts with `status: 'writing'`
- **Supabase**: Only scheduled drafts (`status: 'scheduled'`)

---

## Industry Research: Thread Handling

### How Other Platforms Store Threads

**Industry Standard**: Separate database rows per post with relational links.

All major platforms (Typefully, Buffer, Postiz) store each post as its own row with:

- `thread_id` - groups posts into a thread
- `thread_index` or `position` - ordering within thread
- `status` - per-post lifecycle tracking

### How Platforms Handle Partial Failures

**Typefully's Approach**:

- When any post fails, **entire thread fails**
- Automatically **deletes already-published posts** from Twitter
- User must fix and republish complete thread

**Why This Won't Work for Farcaster**:

> ⚠️ **Critical**: Farcaster casts are **immutable** once published. They cannot be deleted.

Therefore, Herocast **must** use a partial success model:

- Keep published posts as-is (they worked, can't delete anyway)
- Track which posts failed
- Allow retry from failure point

---

## Design Decisions

### Storage Strategy for #668

**For immediate publishing (this ticket):**

- Thread fields (`threadId`, `threadIndex`) added to `DraftType`
- Persisted automatically via existing sessionStorage middleware
- No database schema changes required

**For scheduled threads (#682 - deferred):**

- Will require adding `thread_id` and `thread_index` columns to `draft` table
- Each thread post stored as separate row
- Edge function will need thread-aware publishing logic

### Partial Failure Handling

Given Farcaster's immutability, our approach:

```
Thread [A₀, B₁, C₂, D₃, E₄] → Publish starts

A₀ → ✓ Published (hash: 0x123...)
B₁ → ✓ Published (parentCastId: 0x123...)
C₂ → ✗ FAILED (rate limit)
D₃ → ⏸ Skipped
E₄ → ⏸ Skipped

Result: ThreadPublishResult {
  success: false,
  publishedPosts: [
    { draftId: A.id, hash: "0x123...", index: 0 },
    { draftId: B.id, hash: "0x456...", index: 1 }
  ],
  failedAt: 2,
  error: "Rate limit exceeded",
  threadId: "..."
}
```

**Post-failure state:**

- Posts A, B: `status: 'published'`, have `hash` field set
- Posts C, D, E: `status: 'writing'`, remain as drafts
- Thread structure preserved - UI can show retry option

**Sentry tracking**: Errors automatically captured via existing config (`replaysOnErrorSampleRate: 1.0`)

### Thread Removal Semantics

```
Thread [A₀, B₁, C₂] → removePostFromThread(B) → Thread [A₀, C₁]
Thread [A₀, C₁]     → removePostFromThread(C) → Thread [A₀]  (single-post thread)
Thread [A₀]         → addPostToThread()       → Thread [A₀, D₁]
```

A thread with one post remains a valid thread. The `threadId` persists, allowing the user to add more posts later.

---

## Proposed Changes

### 1. Type Changes (`src/common/constants/farcaster.ts`)

```typescript
// New constant
export const MAX_THREAD_POSTS = 10;

// New type for publish results
export type ThreadPublishResult = {
  success: boolean;
  publishedPosts: { draftId: UUID; hash: string; index: number }[];
  failedAt?: number; // Index where publishing failed
  error?: string; // Error message from failed post
  threadId: UUID; // For reference
};

// Extended DraftType
export type DraftType = {
  // ... existing fields unchanged

  // New thread fields
  threadId?: UUID; // Links drafts in same thread
  threadIndex?: number; // 0-indexed position within thread
};
```

### 2. Store Methods (`src/stores/useDraftStore.ts`)

#### New Interface Extensions

```typescript
interface DraftStoreActions {
  // ... existing methods

  // Thread creation & management
  createThread: () => UUID;
  addPostToThread: (threadId: UUID, afterIndex?: number) => UUID | null;
  removePostFromThread: (threadId: UUID, draftId: UUID) => void;
  reorderThreadPost: (threadId: UUID, fromIndex: number, toIndex: number) => void;

  // Thread queries
  getThreadDrafts: (threadId: UUID) => DraftType[];
  isThreadDraft: (draftId: UUID) => boolean;

  // Thread publishing
  publishThread: (threadId: UUID, account: AccountObjectType) => Promise<ThreadPublishResult>;
}
```

#### Method Specifications

| Method                 | Signature                                             | Description                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createThread`         | `() => UUID`                                          | Creates new draft with `threadId` and `threadIndex=0`. Returns `threadId`.                                                                                       |
| `addPostToThread`      | `(threadId, afterIndex?) => UUID \| null`             | Adds post to thread. Returns `draftId` or `null` if `MAX_THREAD_POSTS` exceeded. If `afterIndex` provided, inserts at that position and shifts subsequent posts. |
| `removePostFromThread` | `(threadId, draftId) => void`                         | Removes post and reindexes remaining posts (0, 1, 2...).                                                                                                         |
| `reorderThreadPost`    | `(threadId, fromIndex, toIndex) => void`              | Moves post from one index to another, updates all indices.                                                                                                       |
| `getThreadDrafts`      | `(threadId) => DraftType[]`                           | Returns all drafts with matching `threadId`, sorted by `threadIndex`.                                                                                            |
| `isThreadDraft`        | `(draftId) => boolean`                                | Returns `true` if draft has a `threadId`.                                                                                                                        |
| `publishThread`        | `(threadId, account) => Promise<ThreadPublishResult>` | Publishes thread sequentially. See publishing logic below.                                                                                                       |

#### Publishing Logic

Per #666, threads are posted as **parallel replies to first post** (not chained):

```
✅ Correct: A ← B, A ← C, A ← D  (all reply to A)
❌ Wrong:   A ← B ← C ← D        (chained replies)
```

Implementation:

```typescript
publishThread: async (threadId: UUID, account: AccountObjectType): Promise<ThreadPublishResult> => {
  const posts = getThreadDrafts(threadId);

  if (posts.length === 0) {
    return { success: false, publishedPosts: [], threadId, error: 'No posts in thread' };
  }

  const result: ThreadPublishResult = {
    success: true,
    publishedPosts: [],
    threadId,
  };

  // 1. Publish first post
  const firstDraft = posts[0];
  let firstHash: string;

  try {
    firstHash = await publishDraftById(firstDraft.id, account);
    if (!firstHash) throw new Error('Failed to publish first post');
    result.publishedPosts.push({ draftId: firstDraft.id, hash: firstHash, index: 0 });
  } catch (error) {
    result.success = false;
    result.failedAt = 0;
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }

  // 2. Publish remaining posts as replies to first post
  for (let i = 1; i < posts.length; i++) {
    const post = posts[i];

    // Set parentCastId to first post
    updateDraftById(post.id, {
      parentCastId: {
        fid: Number(account.platformAccountId),
        hash: firstHash,
      },
    });

    try {
      const hash = await publishDraftById(post.id, account);
      if (!hash) throw new Error(`Failed to publish post ${i + 1}`);
      result.publishedPosts.push({ draftId: post.id, hash, index: i });
    } catch (error) {
      result.success = false;
      result.failedAt = i;
      result.error = error instanceof Error ? error.message : String(error);
      break; // Stop on first failure
    }
  }

  return result;
};
```

### 3. Unit Tests (`src/stores/__tests__/useDraftStore.thread.test.ts`)

```typescript
import { describe, expect, test, beforeEach } from '@jest/globals';
import { useDraftStore } from '@/stores/useDraftStore';
import { MAX_THREAD_POSTS } from '@/common/constants/farcaster';

describe('useDraftStore thread operations', () => {
  beforeEach(() => {
    useDraftStore.getState().removeAllPostDrafts();
  });

  describe('createThread', () => {
    test('creates draft with threadId and threadIndex=0', () => {
      const threadId = useDraftStore.getState().createThread();
      const drafts = useDraftStore.getState().getThreadDrafts(threadId);

      expect(drafts).toHaveLength(1);
      expect(drafts[0].threadId).toBe(threadId);
      expect(drafts[0].threadIndex).toBe(0);
    });
  });

  describe('addPostToThread', () => {
    test('adds post with correct threadId and incremented index', () => {
      const threadId = useDraftStore.getState().createThread();
      useDraftStore.getState().addPostToThread(threadId);

      const drafts = useDraftStore.getState().getThreadDrafts(threadId);
      expect(drafts).toHaveLength(2);
      expect(drafts[1].threadIndex).toBe(1);
    });

    test('inserts at afterIndex and shifts subsequent', () => {
      const threadId = useDraftStore.getState().createThread();
      useDraftStore.getState().addPostToThread(threadId); // index 1
      useDraftStore.getState().addPostToThread(threadId); // index 2

      const newDraftId = useDraftStore.getState().addPostToThread(threadId, 0); // insert after 0
      const drafts = useDraftStore.getState().getThreadDrafts(threadId);

      expect(drafts).toHaveLength(4);
      expect(drafts[1].id).toBe(newDraftId);
      expect(drafts.map((d) => d.threadIndex)).toEqual([0, 1, 2, 3]);
    });

    test('returns null when MAX_THREAD_POSTS exceeded', () => {
      const threadId = useDraftStore.getState().createThread();

      for (let i = 1; i < MAX_THREAD_POSTS; i++) {
        useDraftStore.getState().addPostToThread(threadId);
      }

      const result = useDraftStore.getState().addPostToThread(threadId);
      expect(result).toBeNull();
      expect(useDraftStore.getState().getThreadDrafts(threadId)).toHaveLength(MAX_THREAD_POSTS);
    });
  });

  describe('removePostFromThread', () => {
    test('removes post and reindexes remaining', () => {
      const threadId = useDraftStore.getState().createThread();
      const draft2Id = useDraftStore.getState().addPostToThread(threadId)!;
      useDraftStore.getState().addPostToThread(threadId);

      useDraftStore.getState().removePostFromThread(threadId, draft2Id);

      const drafts = useDraftStore.getState().getThreadDrafts(threadId);
      expect(drafts).toHaveLength(2);
      expect(drafts.map((d) => d.threadIndex)).toEqual([0, 1]);
    });

    test('single post thread remains valid after removal', () => {
      const threadId = useDraftStore.getState().createThread();
      const draft2Id = useDraftStore.getState().addPostToThread(threadId)!;

      useDraftStore.getState().removePostFromThread(threadId, draft2Id);

      const drafts = useDraftStore.getState().getThreadDrafts(threadId);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].threadId).toBe(threadId);
    });
  });

  describe('reorderThreadPost', () => {
    test('swaps indices correctly', () => {
      const threadId = useDraftStore.getState().createThread();
      useDraftStore.getState().addPostToThread(threadId);
      useDraftStore.getState().addPostToThread(threadId);

      const draftsBefore = useDraftStore.getState().getThreadDrafts(threadId);
      const firstDraftId = draftsBefore[0].id;
      const lastDraftId = draftsBefore[2].id;

      useDraftStore.getState().reorderThreadPost(threadId, 0, 2);

      const draftsAfter = useDraftStore.getState().getThreadDrafts(threadId);
      expect(draftsAfter[0].id).toBe(draftsBefore[1].id);
      expect(draftsAfter[2].id).toBe(firstDraftId);
    });
  });

  describe('getThreadDrafts', () => {
    test('returns drafts sorted by threadIndex', () => {
      const threadId = useDraftStore.getState().createThread();
      useDraftStore.getState().addPostToThread(threadId);
      useDraftStore.getState().addPostToThread(threadId);

      const drafts = useDraftStore.getState().getThreadDrafts(threadId);

      for (let i = 0; i < drafts.length; i++) {
        expect(drafts[i].threadIndex).toBe(i);
      }
    });

    test('returns empty array for non-existent threadId', () => {
      const drafts = useDraftStore.getState().getThreadDrafts('non-existent-id' as any);
      expect(drafts).toEqual([]);
    });
  });

  describe('isThreadDraft', () => {
    test('returns true for thread draft', () => {
      const threadId = useDraftStore.getState().createThread();
      const drafts = useDraftStore.getState().getThreadDrafts(threadId);

      expect(useDraftStore.getState().isThreadDraft(drafts[0].id)).toBe(true);
    });

    test('returns false for non-thread draft', () => {
      useDraftStore.getState().addNewPostDraft({ text: 'single post' });
      const drafts = useDraftStore.getState().drafts;

      expect(useDraftStore.getState().isThreadDraft(drafts[0].id)).toBe(false);
    });
  });
});
```

---

## Files to Modify

| File                                                | Changes                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `src/common/constants/farcaster.ts`                 | Add `MAX_THREAD_POSTS`, `ThreadPublishResult`, extend `DraftType` |
| `src/stores/useDraftStore.ts`                       | Add 7 thread methods                                              |
| `src/stores/__tests__/useDraftStore.thread.test.ts` | New test file                                                     |

---

## Acceptance Criteria

- [ ] Add `threadId` and `threadIndex` fields to DraftType
- [ ] Implement `createThread()` - creates first draft with threadId
- [ ] Implement `addPostToThread()` - adds draft linked to thread, enforces MAX_THREAD_POSTS
- [ ] Implement `removePostFromThread()` - removes and reindexes
- [ ] Implement `reorderThreadPost()` - updates threadIndex values
- [ ] Implement `getThreadDrafts()` - returns sorted array
- [ ] Implement `isThreadDraft()` - checks if draft is part of thread
- [ ] Implement `publishThread()` - sequential publishing with error handling
- [ ] Thread drafts persist in sessionStorage (automatic via existing middleware)
- [ ] Unit tests for thread operations
- [ ] Sentry captures partial publish failures (automatic via existing config)

---

## Out of Scope (Deferred to #682)

- Database schema changes for `thread_id`, `thread_index` columns
- Scheduled thread publishing
- Edge function thread-aware publishing
- Thread scheduling UI

---

## Related Issues

- **Enables**: #666 (Thread composer UI)
- **Deferred**: #682 (Scheduled thread publishing)
- **Dependency**: #667 (Draft store bug fixes) - ✅ Closed
