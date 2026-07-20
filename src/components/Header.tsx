import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Bot, Menu, GraduationCap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MORE_NAV, NAV_GROUPS, type NavigationItem } from "@/data/navLinks";
import CourseContextBar from "./CourseContextBar";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { withCourseContext } from "@/course-context/catalog";
import { isAIAssistantEnabled } from "@/domain-v2/shared/feature-flags";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface HeaderProps {
  title?: string;
  links?: { label: string; to: string }[];
  scrolled?: boolean;
}

export default function Header({ title: _headerTitle }: HeaderProps) {
  void _headerTitle;
  const location = useLocation();
  const { context } = useCourseContext();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const aiEnabled = isAIAssistantEnabled();

  /* Scroll listener for nav-glass background transition */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isItemActive = (item: NavigationItem) => (
    location.pathname === item.to
    || (item.to !== "/" && location.pathname.startsWith(`${item.to}/`))
  );
  const itemHref = (item: NavigationItem) => item.preserveCourse
    ? withCourseContext(item.to, context)
    : item.to;

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
          to={withCourseContext("/", context)}
          className="group flex items-center gap-2 no-underline"
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "bg-gradient-to-br from-[#675A4D] to-[#A69888]",
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
              "transition-colors duration-300 group-hover:text-[#675A4D]"
            )}
          >
            ExamBridge
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="主导航" className="hidden items-center gap-[clamp(12px,1.7vw,24px)] md:flex">
          {aiEnabled && <Link
            to={withCourseContext("/ai-assistant", context)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold no-underline transition",
              location.pathname === "/ai-assistant"
                ? "border-[#526b7e] bg-[#253b46] text-white"
                : "border-[#b8c4c5] bg-white/70 text-[#3f5963] hover:border-[#526b7e] hover:bg-white",
            )}
          ><Bot size={14} />AI 问答</Link>}
          {NAV_GROUPS.map((group) => {
            const isActive = group.items.some(isItemActive);
            return (
              <div key={group.label} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex items-center gap-1 whitespace-nowrap py-1 text-[13px] font-medium tracking-wide transition-colors",
                    isActive ? "text-[#675A4D]" : "text-[#625C54] hover:text-[#675A4D]",
                  )}
                  aria-haspopup="menu"
                >
                  {group.label}
                  <ChevronDown size={13} className="transition-transform group-focus-within:rotate-180 group-hover:rotate-180" />
                  {isActive && <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#A69888]" />}
                </button>
                <div data-nav-dropdown-bridge className="pointer-events-none invisible absolute left-1/2 top-full z-20 w-64 -translate-x-1/2 pt-2 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                  <div className="rounded-xl border border-[#d9d4ce] bg-[#fbf9f6] p-2 shadow-[0_18px_48px_rgba(61,56,50,0.14)]" role="menu">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={itemHref(item)}
                        role="menuitem"
                        className={cn(
                          "block rounded-lg px-3 py-2.5 no-underline transition-colors hover:bg-[#eee8e1]",
                          isItemActive(item) && "bg-[#eee8e1]",
                        )}
                      >
                        <span className="block text-sm font-semibold text-[#3d3832]">{item.label}</span>
                        {item.description && <span className="mt-0.5 block text-[11px] leading-4 text-[#716a61]">{item.description}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="group relative">
            <button type="button" className="inline-flex items-center gap-1 py-1 text-[13px] font-medium tracking-wide text-[#625c54] hover:text-[#675a4d]" aria-haspopup="menu">更多 <ChevronDown size={13} /></button>
            <div data-nav-dropdown-bridge className="pointer-events-none invisible absolute right-0 top-full z-20 min-w-44 pt-2 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
              <div className="rounded-lg border border-[#d9d4ce] bg-[#f8f5f1] p-1 shadow-lg" role="menu">
                {MORE_NAV.map((link) => <Link key={link.to} to={itemHref(link)} role="menuitem" className="block rounded-md px-3 py-2 text-sm text-[#625c54] no-underline hover:bg-[#ece6df] hover:text-[#675a4d]">{link.label}</Link>)}
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile: hamburger → Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9D4CE] bg-white/60 text-[#625C54] transition-colors hover:bg-white hover:text-[#675A4D]"
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
            <div className="flex flex-col gap-5 overflow-y-auto p-6 pt-12">
              {aiEnabled && <section aria-labelledby="mobile-nav-ai">
                <h2 id="mobile-nav-ai" className="mb-1 px-4 text-[11px] font-semibold tracking-[0.12em] text-[#887f75]">智能助手</h2>
                <Link to={withCourseContext("/ai-assistant", context)} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline", location.pathname === "/ai-assistant" ? "bg-[#253b46] text-white" : "bg-white/70 text-[#3f5963]")}><Bot size={15} />AI 问答</Link>
              </section>}
              {NAV_GROUPS.map((group) => (
                <section key={group.label} aria-labelledby={`mobile-nav-${group.label}`}>
                  <h2 id={`mobile-nav-${group.label}`} className="mb-1 px-4 text-[11px] font-semibold tracking-[0.12em] text-[#887f75]">{group.label}</h2>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={itemHref(item)}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-colors",
                          isItemActive(item)
                            ? "bg-[rgba(166,152,136,0.14)] text-[#675A4D]"
                            : "text-[#625C54] hover:bg-[rgba(166,152,136,0.08)] hover:text-[#675A4D]",
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
              <section aria-labelledby="mobile-nav-more">
                <h2 id="mobile-nav-more" className="mb-1 px-4 text-[11px] font-semibold tracking-[0.12em] text-[#887f75]">更多</h2>
                {MORE_NAV.map((item) => (
                  <Link key={item.to} to={itemHref(item)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-4 py-2.5 text-sm font-medium text-[#625C54] no-underline hover:bg-[rgba(166,152,136,0.08)] hover:text-[#675A4D]">{item.label}</Link>
                ))}
              </section>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <CourseContextBar />
    </header>
  );
}
