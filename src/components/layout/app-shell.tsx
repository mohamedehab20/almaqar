"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { GuestBanner } from "./guest-banner";
import type { RoomAccess } from "./app-sidebar";

type AppShellProps = {
  companySlug: string;
  userName: string;
  /** A real signed-in session (not the public demo): shows the sign-out button */
  signedIn?: boolean;
  /** Rooms the member may open (null: the demo, everything open) */
  access?: RoomAccess;
  children: React.ReactNode;
};

/** Signed-in layout: dark sidebar on the start side (a drawer on small screens), top bar, page content. */
export function AppShell({ companySlug, userName, signedIn = false, access = null, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-container">
      <aside className="hidden w-72 shrink-0 lg:block">
        <AppSidebar companySlug={companySlug} access={access} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] shadow-ambient-lg">
            <AppSidebar companySlug={companySlug} access={access} onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The public demo (not signed in): make clear nothing is saved */}
        {!signedIn && <GuestBanner />}
        <AppTopbar userName={userName} signedIn={signedIn} onMenu={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
