interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'default' | 'good' | 'warn' | 'alert';
}

export function StatCard({
  title,
  value,
  subtitle,
  tone = 'default',
}: StatCardProps) {
  return (
    <section className={`stat-card ${tone}`}>
      <p className="stat-title">{title}</p>
      <div className="stat-value">{value}</div>
      <p className="stat-subtitle">{subtitle}</p>
    </section>
  );
}
