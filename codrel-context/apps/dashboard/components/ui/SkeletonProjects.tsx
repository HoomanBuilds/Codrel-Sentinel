export default function VectorIndicesSkeleton() {
  return (
    <div className="space-y-6 py-10 animate-pulse">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-neutral-800 rounded" />
          <div className="h-3 w-56 bg-neutral-900 rounded" />
        </div>
        <div className="h-8 w-24 bg-neutral-800 rounded" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-4 flex items-center gap-4 bg-[#1c1c1c] border border-neutral-800 rounded"
          >
            <div className="h-10 w-10 rounded-full bg-neutral-800" />
            <div className="space-y-2">
              <div className="h-6 w-16 bg-neutral-700 rounded" />
              <div className="h-3 w-24 bg-neutral-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <div className="h-9 w-full bg-neutral-900 rounded" />
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="p-5 bg-[#1c1c1c] border border-neutral-800 rounded"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <div className="h-4 w-40 bg-neutral-800 rounded" />
                  <div className="h-3 w-56 bg-neutral-900 rounded" />
                  <div className="flex gap-3 mt-2">
                    <div className="h-3 w-20 bg-neutral-800 rounded" />
                    <div className="h-3 w-24 bg-neutral-800 rounded" />
                    <div className="h-3 w-16 bg-neutral-800 rounded" />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="h-2 w-20 bg-neutral-800 rounded" />
                  <div className="h-8 w-8 bg-neutral-900 rounded" />
                </div>
              </div>
            </div>
          ))}

          {/* Empty state skeleton */}
          <div className="py-12 border border-dashed border-neutral-800 rounded-lg bg-neutral-900/20" />
        </div>
      </div>
    </div>
  );
}
