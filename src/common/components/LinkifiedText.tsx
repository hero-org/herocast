import Linkify from 'linkify-react';
import type React from 'react';
import { cn } from '@/lib/utils';

export interface LinkifiedTextProps {
  children: string;
  /** Wrapper element type */
  as?: 'p' | 'span' | 'div';
  /** Additional class names for the wrapper */
  className?: string;
  /** Class names for links (merged with defaults) */
  linkClassName?: string;
  /** Truncate URLs longer than this (default: 42) */
  truncateUrls?: number;
  /** Filter out URLs starting with $ (cashtags) */
  filterCashtags?: boolean;
  /** Inline styles for the wrapper */
  style?: React.CSSProperties;
}

const renderLink = (
  { attributes, content }: { attributes: Record<string, string>; content: string },
  linkClassName?: string
) => {
  const { href, ...rest } = attributes;
  return (
    <a
      key={href}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'underline decoration-current underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer',
        linkClassName
      )}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      {content}
    </a>
  );
};

/**
 * Renders text with clickable URL links.
 *
 * A lightweight component for linkifying URLs in text. For full Farcaster
 * feature support (mentions, cashtags, channels with hover cards), see
 * the Linkify implementation in CastRow.tsx.
 *
 * @example
 * // Basic usage
 * <LinkifiedText>Check out https://example.com for more info</LinkifiedText>
 *
 * @example
 * // Custom styling
 * <LinkifiedText
 *   as="span"
 *   className="text-sm"
 *   linkClassName="text-blue-400"
 * >
 *   {message.text}
 * </LinkifiedText>
 */
export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  children,
  as = 'span',
  className,
  linkClassName,
  truncateUrls = 42,
  filterCashtags = false,
  style,
}) => {
  if (!children) return null;

  const options: any = {
    render: {
      url: (props: { attributes: Record<string, string>; content: string }) => renderLink(props, linkClassName),
    },
    truncate: truncateUrls,
  };

  if (filterCashtags) {
    options.validate = {
      url: (value: string): boolean => !value.startsWith('$'),
    };
  }

  return (
    <Linkify as={as} options={options} className={className} style={style}>
      {children}
    </Linkify>
  );
};

export default LinkifiedText;
