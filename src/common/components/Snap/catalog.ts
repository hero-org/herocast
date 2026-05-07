'use client';

import { createRenderer } from '@json-render/react';
import { snapJsonRenderCatalog } from '@farcaster/snap/ui';
import { SnapText } from './components/text';
import { SnapStack } from './components/stack';
import { SnapButton } from './components/button';
import { SnapInput } from './components/input';
import { SnapBadge } from './components/badge';
import { SnapIcon } from './components/icon';
import { SnapImage } from './components/image';
import { SnapItem } from './components/item';
import { SnapItemGroup } from './components/item-group';
import { SnapSwitch } from './components/switch';
import { SnapToggleGroup } from './components/toggle-group';
import { SnapProgress } from './components/progress';
import { SnapSeparator } from './components/separator';
import { SnapSlider } from './components/slider';
import { SnapBarChart } from './components/bar-chart';
import { SnapCellGrid } from './components/cell-grid';

export const HerocastSnapRenderer = createRenderer(snapJsonRenderCatalog, {
  text: SnapText,
  stack: SnapStack,
  button: SnapButton,
  input: SnapInput,
  badge: SnapBadge,
  icon: SnapIcon,
  image: SnapImage,
  item: SnapItem,
  item_group: SnapItemGroup,
  switch: SnapSwitch,
  toggle_group: SnapToggleGroup,
  progress: SnapProgress,
  separator: SnapSeparator,
  slider: SnapSlider,
  bar_chart: SnapBarChart,
  cell_grid: SnapCellGrid,
} as any);
