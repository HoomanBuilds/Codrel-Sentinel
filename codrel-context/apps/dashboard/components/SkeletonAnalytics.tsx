export default function AnalyticsDashboardSkeleton() {
  return (
    <div className="py-10 space-y-4 animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-neutral-800 rounded" />
          <div className="h-3 w-56 bg-neutral-900 rounded" />
        </div>
        <div className="h-8 w-48 bg-neutral-800 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 h-[120px] bg-[#1c1c1c] border border-neutral-800 rounded flex flex-col justify-between"
          >
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-neutral-800 rounded" />
              <div className="h-4 w-4 bg-neutral-800 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-16 bg-neutral-700 rounded" />
              <div className="h-2 w-24 bg-neutral-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-[#1c1c1c] border border-neutral-800 rounded">
          <div className="p-6">
            <div className="h-4 w-40 bg-neutral-800 rounded mb-4" />
            <div className="h-52 bg-neutral-900 rounded" />
          </div>
        </div>

        <div className="grid grid-rows-2 gap-4">
          <div className="h-32 bg-[#1c1c1c] border border-neutral-800 rounded p-5">
            <div className="h-3 w-24 bg-neutral-800 rounded mb-4" />
            <div className="h-8 w-28 bg-neutral-700 rounded" />
          </div>

          <div className="h-32 bg-[#1c1c1c] border border-neutral-800 rounded p-5">
            <div className="h-3 w-32 bg-neutral-800 rounded mb-3" />
            <div className="h-24 bg-neutral-900 rounded" />
          </div>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-neutral-800 rounded">
        <div className="p-4 border-b border-neutral-800 flex justify-between">
          <div className="h-3 w-32 bg-neutral-800 rounded" />
          <div className="h-3 w-10 bg-neutral-800 rounded" />
        </div>

        <div className="p-4 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 bg-neutral-900 rounded" />
          ))}
        </div>

        <div className="p-3 border-t border-neutral-800">
          <div className="h-3 w-24 mx-auto bg-neutral-800 rounded" />
        </div>
      </div>
    </div>
  );
}
