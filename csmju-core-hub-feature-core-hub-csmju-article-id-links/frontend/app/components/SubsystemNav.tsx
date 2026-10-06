"use client";

import Link from "next/link";
import { AppsIcon, ArrowForwardIcon, OpenInNewIcon } from "./icons";
import type { DirectoryEntry } from "../lib/api";
import { GROUP_MENU_FROM, groupByCategory } from "../lib/subsystems";

/**
 * "ระบบย่อย" section of the sidebar — rendered from the Subsystem Registry,
 * not from a hardcoded list, so a subsystem that is registered, approved and
 * active shows up here the moment the registry changes.
 *
 * Each entry links to /sso/authorize?subsystem=<name>, which performs the
 * Core Hub SSO handoff server-side and redirects to the subsystem's
 * registered callback URL. The link carries no `state`: a subsystem on the
 * current standard answers such a callback by starting its own sign-in at
 * /auth/login, which comes back through here with a state it can check,
 * while a subsystem still on standard 1.0 accepts it as it always has.
 *
 * The route sits outside /api so proxy.ts renews an expired access token
 * first; under /api a sidebar click after 15 idle minutes lost the session.
 * These are real navigations out of the Core Hub app, so they are <a>, not
 * next/link.
 *
 * The list is the API's: only subsystems the user's role (or an approved
 * exception) may enter. Past GROUP_MENU_FROM entries it is grouped by
 * category into collapsible sections, and links to the full page (/apps).
 */
export default function SubsystemNav({
  subsystems,
  onNavigate,
  compact = false,
}: {
  subsystems: DirectoryEntry[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  if (subsystems.length === 0) {
    return null;
  }

  const pad = compact ? "pl-5" : "pl-7";

  const item = (subsystem: DirectoryEntry) => (
    <li key={subsystem.id}>
      <a
        href={`/sso/authorize?subsystem=${encodeURIComponent(subsystem.name)}`}
        onClick={onNavigate}
        title={subsystem.description ?? `เข้าสู่ ${subsystem.displayName} ผ่าน Core Hub SSO`}
        className={`group flex items-center gap-3 py-3 text-white/70 transition-all hover:bg-white/5 hover:text-white ${pad}`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/15 text-caption font-bold uppercase text-white">
          {subsystem.displayName.trim().charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-md">{subsystem.displayName}</span>
          <span className="block truncate text-caption text-white/50">
            {subsystem.description ?? subsystem.name}
          </span>
        </span>
        <OpenInNewIcon className="mr-4 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
      </a>
    </li>
  );

  const grouped = subsystems.length >= GROUP_MENU_FROM;

  return (
    <div className="mt-6">
      <p className={`flex items-center gap-2 pb-2 text-caption uppercase tracking-wide text-white/50 ${pad}`}>
        <AppsIcon className="h-4 w-4" />
        ระบบย่อย
        <span className="tabular-nums">({subsystems.length})</span>
      </p>

      {grouped ? (
        <div className="space-y-1">
          {groupByCategory(subsystems).map((group) => (
            <details key={group.value} className="group/cat">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-r-lg py-2 pr-4 text-label-md text-white/80 hover:bg-white/5 hover:text-white ${pad}`}
              >
                <span className="truncate">{group.label}</span>
                <span className="flex items-center gap-2 text-caption text-white/50">
                  <span className="tabular-nums">{group.entries.length}</span>
                  <ArrowForwardIcon className="h-3.5 w-3.5 transition-transform group-open/cat:rotate-90" />
                </span>
              </summary>
              <ul className="space-y-1 border-l border-white/10 ml-6">{group.entries.map(item)}</ul>
            </details>
          ))}
        </div>
      ) : (
        <ul className="space-y-1">{subsystems.map(item)}</ul>
      )}

      <Link
        href="/apps"
        onClick={onNavigate}
        className={`mt-2 flex items-center gap-2 py-2 text-label-md text-white/70 hover:text-white hover:underline ${pad}`}
      >
        ดูระบบย่อยทั้งหมด
        <ArrowForwardIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
