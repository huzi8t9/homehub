export default function SectionHeading({ title, subtitle, actions }) {
  return (
    <div className="section-heading">
      <div>
        <div className="section-heading__title">{title}</div>
        {subtitle ? <div className="dashboard__subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="section-heading__actions">{actions}</div> : null}
    </div>
  );
}

