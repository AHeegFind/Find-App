"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/find", label: "Find", icon: "search" },
  { href: "/discover", label: "Discover", icon: "explore" },
  { href: "/browse", label: "Browse", icon: "grid_view" },
  { href: "/profile", label: "Profile", icon: "person" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/auth")) return null;
  // The product-detail page owns its own back/save header, no bottom tab context needed there either
  if (pathname?.match(/^\/browse\/product\//)) return null;
  if (pathname?.startsWith("/seller") || pathname?.startsWith("/admin")) return null;

  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ href, label, icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link key={href} href={href} className={`nav-btn ${active ? "active" : ""}`}>
            <span className={`material-symbols-outlined ${active ? "filled" : ""}`} style={{ fontSize: 24 }}>
              {icon}
            </span>
            <span className="label-sm">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
