import { CHANGELOG, CHANGE_TYPE_LABELS, APP_VERSION, type ChangeType } from '../../lib/changelog';
import { cn } from '../../lib/utils';

const TYPE_ORDER: ChangeType[] = ['added', 'changed', 'fixed', 'security'];

const TYPE_STYLES: Record<ChangeType, string> = {
  added:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  changed:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fixed:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  security: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function AdminVersionen() {
  return (
    <div className="p-6 flex flex-col gap-8 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl font-bold">Versionen</h2>
        <p className="text-gray-500 dark:text-stone-500 text-sm mt-1">
          Aktuell installiert: <span className="font-mono font-semibold text-gray-800 dark:text-stone-200">v{APP_VERSION}</span>
        </p>
      </div>

      <ol className="relative border-l-2 border-gray-200 dark:border-stone-800 ml-2 flex flex-col gap-8">
        {CHANGELOG.map((release, i) => (
          <li key={release.version} className="pl-6 relative">
            <span
              className={cn(
                'absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-stone-950',
                i === 0 ? 'bg-sauna-600' : 'bg-gray-300 dark:bg-stone-700'
              )}
            />
            <section className="card p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-stone-100">v{release.version}</h3>
                {i === 0 && (
                  <span className="badge bg-sauna-600 text-white">Aktuell</span>
                )}
                {release.title && (
                  <span className="font-semibold text-gray-700 dark:text-stone-300">{release.title}</span>
                )}
                <span className="ml-auto text-gray-400 dark:text-stone-500 text-sm">{formatDate(release.date)}</span>
              </div>

              {release.note && (
                <p className="text-sm rounded-xl px-3 py-2 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {release.note}
                </p>
              )}

              {TYPE_ORDER.filter(t => release.changes[t]?.length).map(type => (
                <div key={type} className="flex flex-col gap-2">
                  <span className={cn('self-start text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md', TYPE_STYLES[type])}>
                    {CHANGE_TYPE_LABELS[type]}
                  </span>
                  <ul className="list-disc pl-5 flex flex-col gap-1 text-sm text-gray-600 dark:text-stone-400">
                    {release.changes[type]!.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </section>
          </li>
        ))}
      </ol>
    </div>
  );
}
