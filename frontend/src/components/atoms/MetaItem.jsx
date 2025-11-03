export default function MetaItem({ label, value }) {
  if (!value && value !== 0) {
    return null;
  }

  return (
    <div className="meta-item">
      <span>{label}</span>
      <span className="meta-item__value">{value}</span>
    </div>
  );
}

