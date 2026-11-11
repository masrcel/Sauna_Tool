import { ScheduleEntry } from '../types';
import { formatTime, statusColor, statusLabel } from '../lib/utils';
import Avatar from './Avatar';
import ScentBadge from './ScentBadge';
import { cn } from '../lib/utils';

interface Props {
  entry: ScheduleEntry;
  showDetails?: boolean;
  compact?: boolean;
}

export default function AufgussCard({ entry, showDetails = false, compact = false }: Props) {
  const name = entry.custom_name ?? entry.template_name ?? 'Aufguss';
  const subtitle = entry.custom_subtitle ?? entry.template_subtitle;
  const isActive = entry.status === 'läuft';

  return (
    <div className={cn(
      'card p-4 flex flex-col gap-3 transition-all',
      isActive && 'aufguss-active border-sauna-600',
      entry.status === 'fertig' && 'opacity-50',
      entry.status === 'abgesagt' && 'opacity-40 line-through',
      compact && 'p-3 gap-2'
    )}>
      {/* Header: Zeit + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sauna-400 font-mono font-semibold text-lg tabular-nums">
            {formatTime(entry.start_time)}
          </span>
          {entry.end_time && (
            <span className="text-gray-400 dark:text-stone-500 text-sm">– {formatTime(entry.end_time)}</span>
          )}
        </div>
        <span className={cn('badge text-white', statusColor(entry.status))}>
          {statusLabel(entry.status)}
        </span>
      </div>

      {/* Sauna-Name */}
      <div className="text-xs text-steam-400 font-medium uppercase tracking-widest">
        {entry.sauna_name}
      </div>

      {/* Aufguss-Name */}
      <div>
        <h3 className={cn('font-display font-semibold text-gray-900 dark:text-stone-100', compact ? 'text-lg' : 'text-xl')}>
          {name}
        </h3>
        {subtitle && <p className="text-gray-500 dark:text-stone-400 text-sm mt-0.5">{subtitle}</p>}
      </div>

      {/* Düfte */}
      {entry.scents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.scents.map((s, i) => (
            <ScentBadge
              key={i}
              name={s.scent_name}
              color={s.color}
              dosage={showDetails ? s.dosage_ml : undefined}
              note={showDetails ? s.dosage_note : undefined}
              size={compact ? 'sm' : 'md'}
            />
          ))}
        </div>
      )}

      {/* Mitarbeiter */}
      {entry.staff_name && (
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-200 dark:border-stone-800">
          <div className={cn(isActive && 'ring-2 ring-green-500 ring-offset-1 ring-offset-gray-50 dark:ring-offset-stone-900 rounded-full')}>
            <Avatar name={entry.staff_name} url={entry.staff_avatar} size="sm" />
          </div>
          <span className={cn('text-sm', isActive ? 'text-green-400 font-medium' : 'text-gray-700 dark:text-stone-300')}>
            {entry.staff_name}
          </span>
          {isActive && <span className="badge bg-green-600 text-white text-xs ml-auto">aktiv</span>}
        </div>
      )}
    </div>
  );
}
