import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n';

export function ScreenHeader({
  title,
  backTo,
  actions,
}: {
  title: string;
  backTo?: string;
  actions?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center gap-2">
      {backTo && (
        <Link
          to={backTo}
          aria-label={t('common.back')}
          className="-ml-2 inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-fg"
        >
          <ArrowLeft aria-hidden="true" size={22} />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-[1.625rem] font-bold tracking-tight">
        {title}
      </h1>
      {actions}
    </div>
  );
}
