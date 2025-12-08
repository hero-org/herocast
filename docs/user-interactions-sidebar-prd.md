# User Interactions in Right Sidebar - Implementation Plan

> Show relationship context and interaction history between the current user and cast authors in the right sidebar.

## Overview

Enhance the `AuthorContextPanel` right sidebar to display:

1. **Relationship badges** (Follows you, Mutual) - using existing data
2. **Interaction counts** (likes, recasts, replies, mentions) - new API integration

## Current State

### Data Flow

```
AuthorContextPanel
    └── useProfile({ fid: targetFid }, { viewerFid })
            └── GET /api/users?fids={fid}&viewer_fid={viewerFid}
                    └── neynarClient.fetchBulkUsers(fids, { viewerFid })
```

### Already Available (No API Changes Needed)

The profile response already includes `viewer_context`:

```typescript
viewer_context: {
  following: boolean,    // Does viewer follow this user?
  followed_by: boolean,  // Does this user follow viewer?
  blocking: boolean,
  blocked_by: boolean
}
```

### Caching

- **Client**: React Query, 5-min staleTime
- **Server**: In-memory Map (unreliable in serverless - needs migration to `use cache`)

---

## Phase 1: Relationship Badges (Zero API Cost)

### Goal

Display "Follows you" and "Mutual" badges using existing `viewer_context` data.

### Files to Modify

#### 1. `src/common/components/ProfileInfoContent.tsx`

Add relationship badges below the username/display name area.

```typescript
// New component or inline in ProfileInfoContent
const RelationshipBadge = ({ viewerContext }: { viewerContext?: ViewerContext }) => {
  if (!viewerContext) return null;

  const { following, followed_by } = viewerContext;

  if (following && followed_by) {
    return <Badge variant="secondary">Mutual</Badge>;
  }

  if (followed_by) {
    return <Badge variant="outline">Follows you</Badge>;
  }

  return null;
};
```

### UI Design

```
┌─────────────────────────────┐
│ [Avatar] Display Name       │
│          @username [Mutual] │  ← Badge appears here
│                             │
│ Bio text here...            │
└─────────────────────────────┘
```

### Implementation Steps

1. Add `RelationshipBadge` component to `ProfileInfoContent.tsx`
2. Pass `viewer_context` through to the component
3. Style badges to match existing design system

### Estimated Effort: 30 minutes

---

## Phase 2: User Interactions API & Display

### Goal

Show interaction counts: "Liked 25 of your casts", "Recasted 8 posts", etc.

### Neynar API Endpoint

```
GET https://api.neynar.com/v2/farcaster/user/interactions/
Parameters:
  - fids: "viewerFid,targetFid" (comma-separated)
  - type: "follows,recasts,likes,mentions,replies,quotes" (optional filter)

Response:
  interactions: [{
    type: "likes" | "recasts" | "replies" | "mentions" | "quotes" | "follows",
    count: number,
    most_recent_timestamp: string (ISO 8601)
  }]
```

### Files to Create/Modify

#### 1. `app/api/users/interactions/route.ts` (New)

```typescript
import { NextRequest } from 'next/server';
import { cacheLife } from 'next/cache';

// Cached helper function
async function fetchUserInteractions(viewerFid: number, targetFid: number) {
  'use cache';
  cacheLife('hours'); // 5min stale, 1hr revalidate, 1d expire

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/interactions/?fids=${viewerFid},${targetFid}`,
    {
      headers: {
        'x-api-key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch interactions');
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const viewerFid = searchParams.get('viewer_fid');
  const targetFid = searchParams.get('target_fid');

  if (!viewerFid || !targetFid) {
    return Response.json({ error: 'Missing fid parameters' }, { status: 400 });
  }

  try {
    const data = await fetchUserInteractions(parseInt(viewerFid, 10), parseInt(targetFid, 10));

    // Transform to simplified format
    const interactions = data.interactions || [];
    const result = {
      likes: extractInteraction(interactions, 'likes'),
      recasts: extractInteraction(interactions, 'recasts'),
      replies: extractInteraction(interactions, 'replies'),
      mentions: extractInteraction(interactions, 'mentions'),
      quotes: extractInteraction(interactions, 'quotes'),
    };

    return Response.json(result);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    return Response.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }
}

function extractInteraction(interactions: any[], type: string) {
  const interaction = interactions.find((i) => i.type === type);
  return interaction
    ? { count: interaction.count, mostRecent: interaction.most_recent_timestamp }
    : { count: 0, mostRecent: null };
}

export const maxDuration = 20;
```

#### 2. `src/hooks/queries/useUserInteractions.ts` (New)

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface UserInteractions {
  likes: { count: number; mostRecent: string | null };
  recasts: { count: number; mostRecent: string | null };
  replies: { count: number; mostRecent: string | null };
  mentions: { count: number; mostRecent: string | null };
  quotes: { count: number; mostRecent: string | null };
}

async function fetchUserInteractions(viewerFid: number, targetFid: number): Promise<UserInteractions> {
  const params = new URLSearchParams({
    viewer_fid: viewerFid.toString(),
    target_fid: targetFid.toString(),
  });

  const response = await fetch(`/api/users/interactions?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch interactions');
  }
  return response.json();
}

export function useUserInteractions(
  viewerFid: number | undefined,
  targetFid: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.interactions.between(viewerFid ?? 0, targetFid ?? 0),
    queryFn: () => fetchUserInteractions(viewerFid!, targetFid!),
    enabled: options?.enabled !== false && !!viewerFid && !!targetFid && viewerFid !== targetFid,
    staleTime: 1000 * 60 * 15, // 15 minutes client-side
  });
}
```

#### 3. `src/lib/queryKeys.ts` (Update)

Add new query key:

```typescript
export const queryKeys = {
  // ... existing keys
  interactions: {
    between: (viewerFid: number, targetFid: number) => ['interactions', viewerFid, targetFid] as const,
  },
};
```

#### 4. `src/common/components/Sidebar/AuthorContextPanel.tsx` (Update)

Add interactions section:

```typescript
import { useUserInteractions } from '@/hooks/queries/useUserInteractions';
import { formatDistanceToNow } from 'date-fns';

// Inside AuthorContextPanel component:
const { data: interactions, isLoading: interactionsLoading } = useUserInteractions(
  currentUserFid,
  targetFid,
  { enabled: !isShowingCurrentUser && !!targetFid }
);

// In the JSX, after ProfileInfoContent:
{!isShowingCurrentUser && targetFid && (
  <UserInteractionsSection
    interactions={interactions}
    isLoading={interactionsLoading}
  />
)}
```

#### 5. `src/common/components/Sidebar/UserInteractionsSection.tsx` (New)

```typescript
import { Heart, Repeat2, MessageCircle, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserInteractions } from '@/hooks/queries/useUserInteractions';

interface Props {
  interactions?: UserInteractions;
  isLoading: boolean;
}

export function UserInteractionsSection({ interactions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-sidebar-border/20">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!interactions) return null;

  const hasInteractions =
    interactions.likes.count > 0 ||
    interactions.recasts.count > 0 ||
    interactions.replies.count > 0 ||
    interactions.mentions.count > 0;

  if (!hasInteractions) return null;

  return (
    <div className="mt-4 pt-4 border-t border-sidebar-border/20">
      <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
        Your Interactions
      </div>
      <div className="space-y-1.5 text-sm text-foreground/70">
        {interactions.likes.count > 0 && (
          <InteractionRow
            icon={<Heart className="h-3.5 w-3.5" />}
            count={interactions.likes.count}
            label="likes"
            mostRecent={interactions.likes.mostRecent}
          />
        )}
        {interactions.recasts.count > 0 && (
          <InteractionRow
            icon={<Repeat2 className="h-3.5 w-3.5" />}
            count={interactions.recasts.count}
            label="recasts"
            mostRecent={interactions.recasts.mostRecent}
          />
        )}
        {interactions.replies.count > 0 && (
          <InteractionRow
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            count={interactions.replies.count}
            label="replies"
            mostRecent={interactions.replies.mostRecent}
          />
        )}
        {interactions.mentions.count > 0 && (
          <InteractionRow
            icon={<AtSign className="h-3.5 w-3.5" />}
            count={interactions.mentions.count}
            label="mentions"
            mostRecent={interactions.mentions.mostRecent}
          />
        )}
      </div>
    </div>
  );
}

function InteractionRow({
  icon,
  count,
  label,
  mostRecent
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  mostRecent: string | null;
}) {
  const timeAgo = mostRecent
    ? formatDistanceToNow(new Date(mostRecent), { addSuffix: true })
    : null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground/50">{icon}</span>
      <span>
        {count} {label}
        {timeAgo && (
          <span className="text-foreground/40 text-xs ml-1">· {timeAgo}</span>
        )}
      </span>
    </div>
  );
}
```

---

## UI Mockup

```
┌─────────────────────────────────────┐
│ [Avatar] Display Name               │
│          @username [Follows you]    │
│                                     │
│ Bio text here describing the user   │
│ and what they're about...           │
│                                     │
│ 1.2K followers · 500 following      │
│ FID: 12345                          │
├─────────────────────────────────────┤
│ YOUR INTERACTIONS                   │
│ ❤️  25 likes · 2d ago               │
│ 🔁  8 recasts · 1w ago              │
│ 💬  12 replies · 3d ago             │
├─────────────────────────────────────┤
│ VERIFIED ADDRESSES                  │
│ 0x1234...5678              [Copy]   │
├─────────────────────────────────────┤
│ [    View full profile    ]         │
└─────────────────────────────────────┘
```

---

## Caching Strategy

### Server-Side (Next.js `use cache`)

```typescript
'use cache';
cacheLife('hours');
// stale: 5 minutes
// revalidate: 1 hour
// expire: 1 day
```

Rationale: Interaction counts change slowly. Users won't notice if counts are up to 1 hour stale.

### Client-Side (React Query)

```typescript
staleTime: 1000 * 60 * 15, // 15 minutes
```

Rationale: Don't refetch on every sidebar render. 15 min is fine for counts.

---

## Implementation Order

### Phase 1 (30 min)

1. Add `RelationshipBadge` to `ProfileInfoContent.tsx`
2. Test with existing profile data

### Phase 2 (2-3 hours)

1. Create `/api/users/interactions/route.ts` with `use cache`
2. Add query key to `queryKeys.ts`
3. Create `useUserInteractions.ts` hook
4. Create `UserInteractionsSection.tsx` component
5. Update `AuthorContextPanel.tsx` to include interactions
6. Test end-to-end

---

## Edge Cases

1. **Same user**: Don't fetch interactions when viewing own profile
2. **No interactions**: Hide section entirely if all counts are 0
3. **API error**: Gracefully hide section, don't break sidebar
4. **Loading state**: Show skeleton while fetching
5. **Not logged in**: Don't show interactions section (no viewerFid)

---

## Future Enhancements (Not in Scope)

- Click to see actual liked/recasted posts
- "Last interacted X days ago" summary
- Interaction trends over time
- Mutual followers count
