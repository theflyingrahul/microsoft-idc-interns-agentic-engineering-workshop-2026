import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import ChatBubble from "./ChatBubble";

const links = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/log", label: "Log Entry", icon: "✏️" },
  { to: "/history", label: "History", icon: "📋" },
  { to: "/insights", label: "Insights", icon: "🔍" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-pulse-700">
            <span className="text-2xl">💫</span>
            <span>Pulse</span>
          </NavLink>
          <nav className="flex gap-1">
            {links.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-pulse-100 text-pulse-700"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`
                }
              >
                <span className="mr-1.5">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        Pulse — Mood & Energy Tracker · Workshop Seed Project
      </footer>

      {/* Floating chat assistant */}
      <ChatBubble />
    </div>
  );
}
