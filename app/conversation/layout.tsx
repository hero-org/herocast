'use client';

import React from 'react';
import Home from '@/home';

export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  return <Home>{children}</Home>;
}
