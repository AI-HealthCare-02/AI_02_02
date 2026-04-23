import { Sparkles } from 'lucide-react';

export default function ComingSoonPlaceholder({ title, description }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-3 flex justify-center text-[var(--color-text-hint)]">
          <Sparkles size={22} />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-[var(--color-text-secondary)]">
          {description}
        </p>
        <p className="mt-5 inline-block rounded-full bg-[var(--color-card-surface-subtle)] px-3 py-1 text-[12px] text-[var(--color-text-hint)]">
          곧 만나볼 수 있어요
        </p>
      </div>
    </div>
  );
}
