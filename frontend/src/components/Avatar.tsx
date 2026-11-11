import { avatarFallback } from '../lib/utils';

interface Props {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base', xl: 'w-20 h-20 text-xl' };

export default function Avatar({ name, url, size = 'md' }: Props) {
  const cls = `${sizes[size]} rounded-full flex items-center justify-center font-semibold shrink-0`;
  if (url) {
    return <img src={url} alt={name} className={`${cls} object-cover`} />;
  }
  return (
    <div className={`${cls} bg-sauna-700 text-sauna-100`}>
      {avatarFallback(name)}
    </div>
  );
}
