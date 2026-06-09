// next/dynamic shim for the TanStack build. Area B aliases `next/dynamic` → this
// default export; the live Next build keeps real next/dynamic. Drop-in for the
// signature every consumer on main uses (verified via grep):
//
//   const X = dynamic(() => import('./X'), { loading: () => <Spinner/>, ssr: false });
//
// All four consumers (NewCastModal, VideoEmbed, app/providers, app/(app)/post) pass
// `ssr: false` and load a default export — the editor/wallet/HLS-player trees that must
// stay client-only. We implement:
//   - lazy loading via React.lazy (+ Suspense for the loading fallback),
//   - default- AND namespace-export loaders ({default} normalization),
//   - ssr: false  → render nothing on the server and during hydration, then mount the
//     component after the client mounts (mirrors next/dynamic; avoids hydration drift),
//   - ssr: true (default) → render under Suspense on server and client.

import type { ComponentType, ReactElement, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';

type ComponentModule<P> = ComponentType<P> | { default: ComponentType<P> };
type DynamicLoader<P> = () => Promise<ComponentModule<P>>;

export interface DynamicOptions {
  /** Render on the server. Default true; `false` ⇒ client-only (no SSR render). */
  ssr?: boolean;
  /** Shown while the chunk loads (next/dynamic `loading`). */
  loading?: ComponentType;
}

export default function dynamic<P = Record<string, unknown>>(
  loader: DynamicLoader<P>,
  options: DynamicOptions = {}
): ComponentType<P> {
  const { ssr = true, loading: LoadingComponent } = options;

  const LazyComponent = lazy<ComponentType<P>>(async () => {
    const mod = await loader();
    return 'default' in mod ? mod : { default: mod };
  });

  const fallback: ReactNode = LoadingComponent ? <LoadingComponent /> : null;

  // Cast P to an object type so the generic is spreadable; it stays assignable to P.
  const renderLazy = (props: P): ReactElement => <LazyComponent {...(props as P & object)} />;

  if (ssr === false) {
    return function DynamicClientOnly(props: P): ReactElement {
      const [mounted, setMounted] = useState(false);
      useEffect(() => {
        setMounted(true);
      }, []);
      if (!mounted) return <>{fallback}</>;
      return <Suspense fallback={fallback}>{renderLazy(props)}</Suspense>;
    };
  }

  return function DynamicWithSSR(props: P): ReactElement {
    return <Suspense fallback={fallback}>{renderLazy(props)}</Suspense>;
  };
}
