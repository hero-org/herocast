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
