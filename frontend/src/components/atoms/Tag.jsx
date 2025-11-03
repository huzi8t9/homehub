export default function Tag({ children }) {
  if (!children) return null;
  return <span className="tag">{children}</span>;
}

