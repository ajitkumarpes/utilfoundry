import Nav from "./Nav";
import LogoutButton from "./LogoutButton";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Admin sections">
        <p className="brand">UtilFoundry Admin</p>
        <Nav />
        <div className="logout">
          <LogoutButton />
        </div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
