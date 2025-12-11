import { useEditor as useTipTapEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { FarcasterEmbed } from '@/common/types/embeds';
import type { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import type { EditorOptions } from '@tiptap/react';

// Mod-protocol channel type (simplified for our needs)
export type ModChannel = {
  id: string;
  url: string;
  name: string;
  object: string;
  image_url?: string;
  parent_url?: string;
  description?: string;
  created_at?: number;
  lead?: Record<string, unknown>;
};

type UseCastEditorProps = {
  fetchUrlMetadata?: (url: string) => Promise<Record<string, unknown>>;
  onError?: (error: Error) => void;
  onSubmit?: () => Promise<boolean>;
  linkClassName?: string;
  renderMentionsSuggestionConfig: {
    suggestion: Record<string, unknown>;
  };
  renderChannelsSuggestionConfig?: {
    suggestion: Record<string, unknown>;
  };
  editorOptions?: Partial<EditorOptions>;
};

type UseCastEditorReturn = {
  editor: Editor | null;
  getText: () => string;
  setText: (text: string) => void;
  embeds: FarcasterEmbed[];
  getEmbeds: () => FarcasterEmbed[];
  setEmbeds: (embeds: FarcasterEmbed[]) => void;
  addEmbed: (url: string) => void;
  channel: ModChannel | null;
  getChannel: () => ModChannel | null;
  setChannel: (channel: ModChannel | null) => void;
  handleSubmit: () => Promise<boolean>;
};

export function useCastEditor({
  onError,
  onSubmit,
  linkClassName = 'text-blue-500',
  renderMentionsSuggestionConfig,
  renderChannelsSuggestionConfig,
  editorOptions = {},
}: UseCastEditorProps): UseCastEditorReturn {
  // State managed HERE - single source of truth
  const [embeds, setEmbedsState] = useState<FarcasterEmbed[]>([]);
  const [channel, setChannelState] = useState<ModChannel | null>(null);

  // Refs for stable callbacks
  const embedsRef = useRef<FarcasterEmbed[]>([]);
  const channelRef = useRef<ModChannel | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    embedsRef.current = embeds;
  }, [embeds]);

  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // Build extensions array
  const extensions = [
    StarterKit.configure({
      // Disable features we don't need for Farcaster casts
      heading: false,
      codeBlock: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      // Keep: document, text, paragraph, hardBreak, history, bold, italic, strike, code
      hardBreak: {
        keepMarks: true,
      },
    }),
    Link.configure({
      autolink: true,
      openOnClick: false,
      linkOnPaste: true,
      HTMLAttributes: {
        class: linkClassName,
      },
    }),
    Placeholder.configure({
      placeholder: "What's on your mind?",
    }),
    // User mentions (@username)
    Mention.configure({
      HTMLAttributes: {
        class: 'mention',
      },
      suggestion: renderMentionsSuggestionConfig.suggestion,
    }),
  ];

  // Channel mentions (/channel) if provided
  if (renderChannelsSuggestionConfig) {
    extensions.push(
      Mention.extend({ name: 'channel' }).configure({
        HTMLAttributes: {
          class: 'channel-mention',
        },
        suggestion: renderChannelsSuggestionConfig.suggestion,
      })
    );
  }

  // TipTap editor
  // immediatelyRender: false is required for SSR/Next.js to avoid hydration mismatches
  // See: https://tiptap.dev/docs/editor/getting-started/install/nextjs
  const editor = useTipTapEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[150px]',
      },
      ...editorOptions.editorProps,
    },
    parseOptions: {
      preserveWhitespace: 'full',
    },
    onUpdate: editorOptions.onUpdate,
    onCreate: editorOptions.onCreate,
    onDestroy: editorOptions.onDestroy,
    onFocus: editorOptions.onFocus,
    onBlur: editorOptions.onBlur,
  });

  // getText with newline handling (same behavior as mod-protocol)
  const getText = useCallback(() => {
    if (!editor) return '';
    return editor.getText({ blockSeparator: '\n' });
  }, [editor]);

  // setText - set editor content
  const setText = useCallback(
    (text: string) => {
      if (!editor) return;
      editor.commands.setContent(text ? `<p>${text.replace(/\n/g, '<br>')}</p>` : '', {
        emitUpdate: true,
        parseOptions: { preserveWhitespace: 'full' },
      });
    },
    [editor]
  );

  // getEmbeds - return current embeds state
  const getEmbeds = useCallback(() => {
    return embedsRef.current;
  }, []);

  // setEmbeds - replace all embeds
  const setEmbeds = useCallback((newEmbeds: FarcasterEmbed[]) => {
    setEmbedsState(newEmbeds);
  }, []);

  // addEmbed - add a single embed URL with deduplication
  const addEmbed = useCallback((url: string) => {
    setEmbedsState((prev) => {
      // Deduplicate by URL
      if (prev.some((e) => 'url' in e && e.url === url)) {
        return prev; // Already exists
      }
      return [
        ...prev,
        {
          url,
          status: 'loaded' as const,
        },
      ];
    });
  }, []);

  // getChannel - return current channel
  const getChannel = useCallback(() => {
    return channelRef.current;
  }, []);

  // setChannel
  const setChannel = useCallback((newChannel: ModChannel | null) => {
    setChannelState(newChannel);
  }, []);

  // handleSubmit - call onSubmit callback
  const handleSubmit = useCallback(async () => {
    if (onSubmit) {
      return await onSubmit();
    }
    return false;
  }, [onSubmit]);

  return {
    editor,
    getText,
    setText,
    embeds,
    getEmbeds,
    setEmbeds,
    addEmbed,
    channel,
    getChannel,
    setChannel,
    handleSubmit,
  };
}
