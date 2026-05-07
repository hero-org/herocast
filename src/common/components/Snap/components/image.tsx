'use client';

function aspectToRatio(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return 16 / 9;
  return w / h;
}

export function SnapImage({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const url = String(props.url ?? '');
  const aspect = String(props.aspect ?? '16:9');
  const alt = props.alt ? String(props.alt) : '';
  const ratio = aspectToRatio(aspect);

  return (
    <div className="w-full overflow-hidden rounded-md" style={{ aspectRatio: ratio }}>
      <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}
