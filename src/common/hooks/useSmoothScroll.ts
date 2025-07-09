import { useCallback } from 'react';

export const useSmoothScroll = () => {
  const scrollToElement = useCallback((element: HTMLElement | null, options?: ScrollIntoViewOptions) => {
    if (!element) return;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    element.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      ...options
    });
  }, []);

  const scrollToTop = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    container.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }, []);

  return { scrollToElement, scrollToTop };
};