export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted" role="separator">
      <span className="h-px flex-1 bg-outline-variant/40" />
      {label}
      <span className="h-px flex-1 bg-outline-variant/40" />
    </div>
  );
}
