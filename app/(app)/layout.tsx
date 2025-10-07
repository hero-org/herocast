'use client';

import React from 'react';
import Home from '@/home';

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  return <Home>{children}</Home>;
}
