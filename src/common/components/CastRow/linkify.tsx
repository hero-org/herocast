import { registerPlugin } from 'linkifyjs';
import React from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import mentionPlugin, { cashtagPlugin, channelPlugin } from '../../helpers/linkify';
import CashtagHoverCard from '../CashtagHoverCard';
import ProfileHoverCard from '../ProfileHoverCard';

// Register linkify plugins once globally to avoid hot reload warnings
if (typeof window !== 'undefined' && !window.__linkify_plugins_registered) {
  registerPlugin('mention', mentionPlugin);
  registerPlugin('cashtag', cashtagPlugin);
  registerPlugin('channel', channelPlugin);
  window.__linkify_plugins_registered = true;
}

export const MemoizedProfileHoverCard = React.memo(ProfileHoverCard);

const renderMention = ({ attributes, content }) => {
  const { userFid } = attributes;
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
    >
      <MemoizedProfileHoverCard username={content.slice(1)} viewerFid={userFid}>
        {content}
      </MemoizedProfileHoverCard>
    </span>
  );
};

const renderLink = ({ attributes, content }) => {
  const { href } = attributes;
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
        window.open(href, '_blank');
      }}
      rel="noopener noreferrer"
    >
      {content}
    </span>
  );
};

const renderChannel = ({ attributes, content }) => {
  const { router } = attributes;
  // Trim whitespace - linkify may include leading space in the match
  const trimmedContent = content.trim();
  // Extract channel name (remove leading /)
  const channelName = trimmedContent.startsWith('/') ? trimmedContent.slice(1) : trimmedContent;

  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
        const { setSelectedChannelByName } = useAccountStore.getState();
        setSelectedChannelByName(channelName);
        if (router) {
          router.push('/feeds');
        }
      }}
      rel="noopener noreferrer"
    >
      {trimmedContent}
    </span>
  );
};

const renderCashtag = ({ attributes, content }) => {
  if (!content || content.length < 3) {
    return content;
  }

  const tokenSymbol = content.slice(1);
  if (tokenSymbol === 'usd') return null;

  const { userFid } = attributes;

  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
    >
      <CashtagHoverCard tokenSymbol={tokenSymbol.toUpperCase()} userFid={userFid}>
        {content}
      </CashtagHoverCard>
    </span>
  );
};

export const linkifyOptions = {
  render: {
    url: renderLink,
    mention: renderMention,
    cashtag: renderCashtag,
    channel: renderChannel,
  },
  truncate: 42,
};
