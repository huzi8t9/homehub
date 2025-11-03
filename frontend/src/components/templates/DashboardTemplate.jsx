import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Active devices" },
  { to: "/historic", label: "Device history" },
  { to: "/network", label: "Network" },
];

export default function DashboardTemplate({ children }) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">HomeHub</h1>
          <p className="dashboard__subtitle">
            A Graphical view of my home network
          </p>
        </div>
        <nav className="dashboard__nav" aria-label="Sections">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "dashboard__nav-link dashboard__nav-link--active" : "dashboard__nav-link"
              }
              end={link.to === "/"}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="dashboard__content">{children}</main>
    </div>
  );
}

