export default function ChallengeLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-in fade-in duration-200">
      <div className="h-5 w-24 mb-4 rounded bg-white/5" />
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded bg-white/5" />
          <div className="h-5 w-16 rounded bg-white/5" />
          <div className="h-5 w-20 rounded bg-white/5" />
        </div>
        <div className="h-7 w-3/4 rounded bg-white/5 mb-2" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-px bg-white/5 my-4" />
        <div className="flex justify-between">
          <div className="h-5 w-20 rounded bg-white/5" />
          <div className="h-5 w-24 rounded bg-white/5" />
        </div>
      </div>
      <div className="glass rounded-2xl p-6">
        <div className="h-4 w-full rounded bg-white/5 mb-3" />
        <div className="h-4 w-5/6 rounded bg-white/5 mb-3" />
        <div className="h-4 w-4/6 rounded bg-white/5 mb-6" />
        <div className="space-y-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5" />
          ))}
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-28 rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  );
}
