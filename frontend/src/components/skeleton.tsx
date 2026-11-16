function Bone({
  className = "",
  tone = "paper",
}: {
  className?: string;
  tone?: "paper" | "rail";
}) {
  return (
    <span
      className={`block animate-pulse rounded-md ${
        tone === "rail" ? "bg-white/15" : "bg-[#e4ddd0]"
      } ${className}`}
    />
  );
}

export function QueueSkeleton() {
  return (
    <>
      <li className="sr-only">Carregando a fila.</li>
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="px-2" aria-hidden="true">
          <div className="px-3 py-2.5">
            <span className="flex items-center justify-between gap-3">
              <Bone tone="rail" className="h-3 w-24" />
              <Bone tone="rail" className="h-3 w-8" />
            </span>
            <Bone tone="rail" className="mt-2 h-4 w-4/5" />
            <Bone tone="rail" className="mt-2 h-5 w-24 rounded-full" />
          </div>
        </li>
      ))}
    </>
  );
}

export function TicketPaneSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <p className="sr-only">Carregando o chamado.</p>
      <header className="border-b border-line px-4 py-4 sm:px-6" aria-hidden="true">
        <Bone className="h-3 w-40" />
        <Bone className="mt-3 h-8 w-2/3 max-w-md" />
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-5 sm:px-6" aria-hidden="true">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="w-full max-w-2xl rounded-md border border-line bg-white px-4 py-3"
          >
            <Bone className="h-3 w-28" />
            <Bone className="mt-3 h-4 w-full" />
            <Bone className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArticleListSkeleton() {
  return (
    <>
      <li className="sr-only">Carregando a base.</li>
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="border-b border-line px-1 py-3" aria-hidden="true">
          <Bone className="h-4 w-2/3" />
          <Bone className="mt-2 h-3 w-full" />
          <Bone className="mt-1.5 h-3 w-4/5" />
        </li>
      ))}
    </>
  );
}

export function MetricValueSkeleton() {
  return <Bone tone="rail" className="h-3 w-6" />;
}

export function AppSkeleton({ articles = false }: { articles?: boolean }) {
  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-paper" aria-busy="true">
      <p className="sr-only">Carregando.</p>
      <div
        className={`grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden ${
          articles
            ? "lg:grid-cols-[300px_minmax(0,1fr)_minmax(240px,320px)]"
            : "lg:grid-cols-[300px_minmax(0,1fr)]"
        }`}
      >
        <aside className="flex min-h-0 flex-col bg-rail" aria-hidden="true">
          <div className="border-b border-white/10 px-4 py-4">
            <Bone tone="rail" className="h-7 w-32" />
            <Bone tone="rail" className="mt-4 h-3 w-24" />
            <span className="mt-4 flex gap-2">
              <Bone tone="rail" className="h-7 w-16" />
              <Bone tone="rail" className="h-7 w-14" />
              <Bone tone="rail" className="h-7 w-20" />
            </span>
          </div>
          <ul>
            <QueueSkeleton />
          </ul>
        </aside>
        <TicketPaneSkeleton />
        {articles ? (
          <aside className="hidden min-h-0 flex-col border-l border-line lg:flex" aria-hidden="true">
            <div className="border-b border-line px-4 py-4">
              <Bone className="h-7 w-16" />
              <Bone className="mt-3 h-3 w-40" />
            </div>
            <ul className="px-4 py-3">
              <ArticleListSkeleton />
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[320px_minmax(0,1fr)]" aria-busy="true">
      <p className="sr-only">Carregando.</p>
      <aside className="bg-rail px-6 py-8 lg:px-10 lg:py-12" aria-hidden="true">
        <Bone tone="rail" className="h-10 w-40" />
        <Bone tone="rail" className="mt-5 h-4 w-56" />
        <Bone tone="rail" className="mt-2 h-4 w-40" />
      </aside>
      <main className="flex items-center bg-paper px-6 py-10" aria-hidden="true">
        <div className="w-full max-w-md">
          <Bone className="h-3 w-16" />
          <Bone className="mt-3 h-9 w-64" />
          <Bone className="mt-6 h-12 w-full" />
          <Bone className="mt-3 h-12 w-full" />
          <Bone className="mt-4 h-8 w-20" />
        </div>
      </main>
    </div>
  );
}
