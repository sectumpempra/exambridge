import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface HeaderProps {
  title?: string;
  links: { label: string; to: string }[];
  scrolled?: boolean;
}

export default function Header({ title: _headerTitle, links }: HeaderProps) {
  void _headerTitle;
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Scroll listener for nav-glass background transition */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        "border-b",
        isScrolled
          ? "bg-[rgba(240,237,232,0.95)] shadow-[0_1px_20px_rgba(61,56,50,0.08)] border-[rgba(217,212,206,0.5)]"
          : "bg-[rgba(240,237,232,0.85)] border-[rgba(217,212,206,0.3)] backdrop-blur-xl saturate-[1.2]"
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
        {/* Logo with hover animation */}
        <Link
          to="/"
          className="group flex items-center gap-2 no-underline"
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "bg-gradient-to-br from-[#8F7F6E] to-[#A69888]",
              "text-sm font-extrabold text-white tracking-tight",
              "transition-transform duration-300 ease-out",
              "group-hover:scale-110 group-hover:rotate-[-3deg]"
            )}
          >
            <GraduationCap size={16} />
          </div>
          <span
            className={cn(
              "text-base font-bold tracking-wide text-[#3D3832]",
              "transition-colors duration-300 group-hover:text-[#8F7F6E]"
            )}
          >
            GradeMaster
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-[clamp(16px,2.5vw,32px)] md:flex">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "nav-link relative whitespace-nowrap px-0 py-1 text-[13px] font-medium tracking-wide no-underline transition-colors duration-300",
                  isActive
                    ? "text-[#8F7F6E]"
                    : "text-[#8B8378] hover:text-[#8F7F6E]"
                )}
              >
                {link.label}
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#A69888]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile: hamburger → Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9D4CE] bg-white/60 text-[#8B8378] transition-colors hover:bg-white hover:text-[#8F7F6E]"
              aria-label="打开菜单"
            >
              <Menu size={20} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[280px] border-l border-[#D9D4CE] bg-[#F5F2EE] p-0"
          >
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <div className="flex flex-col p-6 pt-12">
              {links.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium no-underline transition-colors",
                      isActive
                        ? "bg-[rgba(166,152,136,0.12)] text-[#8F7F6E]"
                        : "text-[#8B8378] hover:bg-[rgba(166,152,136,0.08)] hover:text-[#8F7F6E]"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
