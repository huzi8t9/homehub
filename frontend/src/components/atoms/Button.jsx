export default function Button({ children, onClick, disabled, title, type = "button" }) {
  return (
    <button className="button" onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

