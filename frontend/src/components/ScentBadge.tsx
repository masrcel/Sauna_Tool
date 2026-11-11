interface Props {
  name: string;
  color?: string;
  dosage?: number | null;
  unit?: string;
  note?: string | null;
  size?: 'sm' | 'md';
}

export default function ScentBadge({ name, color, dosage, unit = 'ml', note, size = 'md' }: Props) {
  const bg = color ?? '#d97d1d';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ backgroundColor: `${bg}22`, color: bg, border: `1px solid ${bg}55` }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bg }} />
      {name}
      {dosage ? <span className="opacity-70">{Math.round(dosage)} {unit}</span> : null}
      {note && note.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
        <span key={tag} className="rounded-full px-1.5 py-px text-xs" style={{ backgroundColor: `${bg}44`, border: `1px solid ${bg}66` }}>{tag}</span>
      ))}
    </span>
  );
}
