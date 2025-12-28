"use client";

import React from "react";
import {
  LayoutTemplate,
  PlusCircle,
  BarChart3,
  LogOut,
  HelpCircle,
  Settings,
  Box,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../components/ui/primitives";
import { signOut } from "next-auth/react";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: any;
  }) => {
    const active = pathname === href || pathname.startsWith(href + "/");

    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
          active
            ? "bg-neutral-800 text-white border border-neutral-700"
            : "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className=" overflow-auto text-neutral-200 flex">
      <aside className="w-56 h-screen overflow-auto border-r border-neutral-800 flex flex-col">
        <div className="p-5 flex items-center gap-3">
          <div className="h-8 w-8 text-black rounded-md flex items-center justify-center">
            <img src="/logocodrel.png" alt="CodrelAi Logo" />
          </div>
          <h1 className="text-white font-bold text-lg">Codrel</h1>
        </div>

        <nav className="px-4 flex-1 space-y-1 mt-3">
          {/* <NavItem href="/console/form" label="Create" icon={PlusCircle} /> */}
          <NavItem
            href="/console/analytics"
            label="Analytics"
            icon={BarChart3}
          />
          <NavItem href="/console/settings" label="Settings" icon={Settings} />
          <NavItem href="/console/projects" label="Projects" icon={Box} />
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-1">
      
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-900/20"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Link>
        </div>
      </aside>

      <main className="flex-1 px-8">{children}</main>
    </div>
  );
}
