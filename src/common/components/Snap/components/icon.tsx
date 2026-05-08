'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Info,
  Clock,
  Heart,
  MessageCircle,
  Repeat,
  Share,
  User,
  Users,
  Star,
  Trophy,
  Zap,
  Flame,
  Gift,
  ImageIcon,
  Play,
  Pause,
  Wallet,
  Coins,
  Plus,
  Minus,
  RefreshCw,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useSnapColors } from '../useSnapColors';

export const ICON_MAP: Record<string, LucideIcon> = {
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'external-link': ExternalLink,
  'chevron-right': ChevronRight,
  check: Check,
  x: X,
  'alert-triangle': AlertTriangle,
  info: Info,
  clock: Clock,
  heart: Heart,
  'message-circle': MessageCircle,
  repeat: Repeat,
  share: Share,
  user: User,
  users: Users,
  star: Star,
  trophy: Trophy,
  zap: Zap,
  flame: Flame,
  gift: Gift,
  image: ImageIcon,
  play: Play,
  pause: Pause,
  wallet: Wallet,
  coins: Coins,
  plus: Plus,
  minus: Minus,
  'refresh-cw': RefreshCw,
  bookmark: Bookmark,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
};

export function SnapIcon({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const name = String(props.name ?? 'info');
  const size = String(props.size ?? 'md') === 'sm' ? 16 : 20;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Icon size={size} style={{ color: colors.colorHex(props.color as string | undefined) }} />
    </span>
  );
}
