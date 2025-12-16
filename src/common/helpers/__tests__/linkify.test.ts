import { describe, it, expect } from '@jest/globals';
import * as linkify from 'linkifyjs';
import { registerPlugin } from 'linkifyjs';
import mentionPlugin, { channelPlugin } from '../linkify';

// Register plugins before tests
registerPlugin('mention', mentionPlugin);
registerPlugin('channel', channelPlugin);

// Simple helper - no additional validation needed since plugin now requires whitespace
function findMatches(text: string): any[] {
  return linkify.find(text);
}

describe('linkify channel plugin', () => {
  describe('false positive prevention', () => {
    it('should NOT match "/combines" in "changes/combines"', () => {
      const text = 'changes/combines';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(0);
    });

    it('should NOT match "/path" in "https://farcaster.xyz/path"', () => {
      const text = 'https://farcaster.xyz/path';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(0);
    });

    it('should NOT match channel in middle of path-like text', () => {
      const text = 'some/path/to/file';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(0);
    });

    it('should NOT break URL detection for complex Farcaster URLs', () => {
      const text = 'https://farcaster.xyz/vrypan.eth/0xecb7d652';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://farcaster.xyz/vrypan.eth/0xecb7d652');
    });
  });

  describe('valid channel mentions', () => {
    // Note: Bare "/degen" at absolute text start won't match - requires whitespace prefix
    // This is a tradeoff to prevent false positives like "word/channel"
    it('should NOT match "/degen" at the absolute start of text (tradeoff)', () => {
      const text = '/degen';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(0);
    });

    // Note: Channel matches include preceding whitespace - strip in render
    it('should match "/degen" after whitespace', () => {
      const text = 'check /degen today';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/degen');
    });

    it('should match "/herocast" after space in sentence', () => {
      const text = 'check /herocast today';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/herocast');
    });

    it('should match channel after tab', () => {
      const text = 'text\t/degen';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/degen');
    });

    it('should match channel after punctuation followed by space', () => {
      const text = 'Cool! /degen is great.';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/degen');
    });
  });

  describe('edge cases', () => {
    it('should handle text with both URLs and channels correctly', () => {
      const text = 'Visit https://example.com and join /degen';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(urlMatches).toHaveLength(1);
      expect(channelMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://example.com');
      expect(channelMatches[0].value.trim()).toBe('/degen');
    });

    it('should not match slash at end of word', () => {
      const text = 'word/ not a channel';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(0);
    });

    it('should match channel with numbers (requires separator)', () => {
      // Note: Due to linkify tokenization, channels with adjacent letters+numbers
      // like /base2024 don't work. Use underscore or hyphen separator.
      const text = 'check /base_2024 out';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/base_2024');
    });

    it('should match channel with hyphen', () => {
      const text = 'join /base-camp today';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/base-camp');
    });

    it('should match channel with underscore', () => {
      const text = 'visit /my_channel please';
      const matches = findMatches(text);
      const channelMatches = matches.filter((m) => m.type === 'channel');
      expect(channelMatches).toHaveLength(1);
      expect(channelMatches[0].value.trim()).toBe('/my_channel');
    });
  });

  describe('URL detection integrity', () => {
    it('should detect http URL correctly', () => {
      const text = 'Visit http://example.com today';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('http://example.com');
    });

    it('should detect https URL correctly', () => {
      const text = 'Visit https://example.com today';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://example.com');
    });

    it('should detect URL with path segments', () => {
      const text = 'Check https://example.com/path/to/page';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://example.com/path/to/page');
    });

    it('should detect URL with query params', () => {
      const text = 'Search https://example.com?q=test&foo=bar';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://example.com?q=test&foo=bar');
    });

    it('should detect URL with hash fragment', () => {
      const text = 'Jump to https://example.com#section';
      const matches = findMatches(text);
      const urlMatches = matches.filter((m) => m.type === 'url');
      expect(urlMatches).toHaveLength(1);
      expect(urlMatches[0].href).toBe('https://example.com#section');
    });
  });
});
