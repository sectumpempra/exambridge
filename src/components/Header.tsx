import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  title: string;
  links: { label: string; to: string }[];
  scrolled?: boolean;
}

export default function Header({ title: _title, links, scrolled = false }: HeaderProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={`nav-glass ${scrolled ? "scrolled" : ""}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background:
                "linear-gradient(135deg, #8F7F6E 0%, #A69888 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#FFF",
              letterSpacing: "-0.02em",
            }}
          >
            G
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#3D3832",
              letterSpacing: "0.02em",
            }}
          >
            GradeMaster
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav
          style={{
            display: "flex",
            gap: "clamp(16px, 2.5vw, 32px)",
            alignItems: "center",
          }}
          className="desktop-nav"
        >
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive ? "active" : ""}`}
                style={{
                  color: isActive ? "#8F7F6E" : "#8B8378",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  transition: "color 0.3s ease",
                  padding: "4px 0",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = "#8F7F6E";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.target as HTMLElement).style.color = "#8B8378";
                  }
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            padding: 8,
            cursor: "pointer",
            color: "#8B8378",
          }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav
          className="mobile-nav"
          style={{
            display: "none",
            flexDirection: "column",
            gap: 4,
            padding: "12px 0 0",
            borderTop: "1px solid #E8E4DE",
            marginTop: 12,
          }}
        >
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  color: isActive ? "#8F7F6E" : "#8B8378",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "10px 0",
                  transition: "color 0.2s ease",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
