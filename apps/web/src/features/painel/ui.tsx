import { HelpHint } from '@/shared/ui/help-hint';
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from './labels';

/** Big card with a title, a "?" help hint and an obvious next step inside. */
export function PanelCard({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-card bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="font-heading text-2xl text-sage-700">
          {title}
        </h2>
        <HelpHint label={title}>{help}</HelpHint>
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-base font-semibold ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-heading text-3xl text-sage-700">{children}</h1>;
}

export function LoadError() {
  return (
    <p role="alert" className="rounded-card bg-danger/10 p-5 font-semibold text-danger">
      Não consegui carregar agora. Confira a internet e atualize a página.
    </p>
  );
}
