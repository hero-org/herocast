'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Home, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen grid-cols-1 grid-rows-[1fr,auto,1fr] bg-background lg:grid-cols-[max(50%,36rem),1fr]">
      <header className="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8">
        <Link href="/" className="inline-block">
          <span className="sr-only">herocast</span>
          <div className="text-2xl font-bold text-foreground">herocast</div>
        </Link>
      </header>
      
      <main className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8">
        <div className="max-w-lg">
          <div className="mb-6">
            <p className="text-base font-semibold text-primary">404</p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Page not found
            </h1>
          </div>
          
          <p className="text-base leading-7 text-foreground/70 mb-8">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The page may have been moved, deleted, or you may have entered the wrong URL.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild className="flex items-center gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go home
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="flex items-center gap-2">
              <Link href="/search">
                <Search className="h-4 w-4" />
                Search
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
          </div>
          
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Popular destinations
            </h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>
                <Link href="/feeds" className="hover:text-foreground transition-colors">
                  Feeds
                </Link>
              </li>
              <li>
                <Link href="/post" className="hover:text-foreground transition-colors">
                  Create Post
                </Link>
              </li>
              <li>
                <Link href="/dms" className="hover:text-foreground transition-colors">
                  Direct Messages
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="hover:text-foreground transition-colors">
                  Analytics
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-foreground transition-colors">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
      
      <div className="hidden lg:relative lg:col-start-2 lg:row-start-1 lg:row-end-4 lg:block">
        <img 
          src="/images/bw-background.png" 
          alt="" 
          className="absolute inset-0 h-full w-full object-cover opacity-50" 
        />
      </div>
    </div>
  );
}