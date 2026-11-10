export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function SkeletonFeed() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} className="h-24" />
      ))}
    </div>
  );
}

export function SkeletonKPIs() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="h-24" />
      ))}
    </div>
  );
}
