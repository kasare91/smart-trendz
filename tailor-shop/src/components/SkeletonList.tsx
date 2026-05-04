interface SkeletonListProps {
  rows?: number;
  cols?: number;
}

export default function SkeletonList({ rows = 5, cols = 4 }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={`h-4 bg-gray-200 dark:bg-gray-700 rounded ${j === 0 ? 'w-1/4' : j === cols - 1 ? 'w-16' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
