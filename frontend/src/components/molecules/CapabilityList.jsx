import Tag from "../atoms/Tag.jsx";

export default function CapabilityList({ capabilities = [] }) {
  if (!capabilities.length) return null;
  return (
    <div className="tag-list">
      {capabilities.map((cap) => (
        <Tag key={cap}>{cap}</Tag>
      ))}
    </div>
  );
}

