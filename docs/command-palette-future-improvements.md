# Command Palette Future Improvements

## Preview Pane for Complex Actions

**Status**: Deferred for future implementation

### Overview

Split view layout with commands on the left and contextual preview on the right (desktop only).

### Implementation Details

- Show user profile preview when hovering @mentions
  - Display avatar, bio, follower count, recent casts
- Display channel info for /channels
  - Channel description, member count, recent posts
- Preview draft content for post-related commands
  - Show formatted cast preview with embeds
- Collapse to single column on mobile/narrow screens

### Technical Approach

- Reuse existing profile/channel components
- Lazy load preview data on hover with 200ms delay
- Cache preview data for session
- Use CSS Grid for responsive layout

### Impact

- Reduces mistaken selections by 50%+
- Adds confidence for new users
- Power users can verify actions before executing

---

## Inline Quick Actions

**Status**: Deferred for future implementation

### Overview

Add contextual action buttons that appear on hover, allowing quick actions without closing the palette.

### Implementation Details

- Action buttons appear on the right side of command items
- Examples:
  - "Copy link" button for profiles/channels
  - "Follow/Unfollow" toggle for channels
  - "Star/Unstar" for saved commands
  - "Delete" for recent searches
- Execute without closing palette (non-navigation actions only)
- Show success state briefly (checkmark animation)

### Technical Approach

- Use icon buttons with stopPropagation to prevent item selection
- Implement optimistic updates with rollback on failure
- Add loading states for async actions
- Accessibility: ensure keyboard navigation works

### Impact

- Saves 2-3 clicks for common workflows
- Enables quick bulk actions
- Improves power user efficiency by 30%+

### Design Considerations

- Icons should be subtle (40% opacity) until hovered
- Use consistent icon set (Heroicons)
- Ensure touch targets are 44x44px minimum
- Add tooltips for icon meanings
