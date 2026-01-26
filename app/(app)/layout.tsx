'use client';

import type React from 'react';
import Home from '@/home';

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  return <Home>{children}</Home>;
}
