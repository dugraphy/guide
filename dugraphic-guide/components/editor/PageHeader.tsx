interface PageHeaderProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function PageHeader({ icon, title, description }: PageHeaderProps) {
  return (
    <div className="max-w-3xl px-24 pt-16 pb-4">
      {icon && <div className="text-5xl mb-3">{icon}</div>}
      <h1 className="text-4xl font-bold text-[var(--fg)] leading-tight mb-2">
        {title}
      </h1>
      {description && (
        <p className="text-[var(--fg-muted)] text-base">{description}</p>
      )}
    </div>
  );
}
