"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  CampaignIcon,
  EyeIcon,
  EyeOffIcon,
  OpenInNewIcon,
} from "../../components/icons";
import type { ExternalContentKind } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { tdClass, thClass } from "../_components/ui";
import FilterBox, { matchesQuery } from "../../components/FilterBox";
import { hideExternalContent, showExternalContent } from "./actions";

export type ExternalContentRow = {
  kind: ExternalContentKind;
  externalId: string;
  title: string;
  imageUrl: string | null;
  /** When csmju.com published it; banners have no date. */
  date: string | null;
  /** The item on csmju.com; `null` when it has no page of its own. */
  href: string | null;
  hidden: boolean;
  /** Still hidden here, but not among the items csmju.com lists now. */
  gone: boolean;
};

const KIND_LABEL: Record<ExternalContentKind, string> = {
  article: "ข่าว",
  banner: "แบนเนอร์",
};

/**
 * csmju.com news and banners as the public front page sees them, with a
 * hide / show toggle per row. Hiding only affects our front page.
 */
export default function ExternalContentTable({
  rows,
}: {
  rows: ExternalContentRow[];
}) {
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const visible = rows.filter((row) => matchesQuery(query, row.title));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (row: ExternalContentRow) => {
    const key = `${row.kind}:${row.externalId}`;
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    startTransition(async () => {
      const result = row.hidden
        ? await showExternalContent(row.kind, row.externalId)
        : await hideExternalContent(row.kind, row.externalId, row.title);
      if (!result.ok) setError(result.error);
      setBusyKey(null);
    });
  };

  if (rows.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-body-md text-on-surface-variant">
        ไม่สามารถโหลดข่าวจาก csmju.com ได้ในขณะนี้
      </p>
    );
  }

  return (
    <>
      <div className="border-b border-outline-variant/40 px-6 py-4">
        <FilterBox
          value={query}
          onChange={setQuery}
          label="ค้นหาข่าวหรือแบนเนอร์จาก csmju.com"
          placeholder="ค้นหาหัวข้อข่าวหรือแบนเนอร์"
          className="max-w-md"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="border-b border-outline-variant/40 bg-error/5 px-6 py-3 text-body-md text-error"
        >
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
              <th className={thClass}>หัวข้อ</th>
              <th className={thClass}>ประเภท</th>
              <th className={thClass}>วันที่</th>
              <th className={thClass}>บนหน้าแรก</th>
              <th className={`${thClass} text-right`}>จัดการ</th>
            </tr>
          </thead>
          <tbody className="text-body-md">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant">
                  ไม่พบรายการที่ตรงกับ &ldquo;{query}&rdquo;
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const key = `${row.kind}:${row.externalId}`;
              const busy = busyKey === key;
              return (
                <tr
                  key={key}
                  className={`border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50 ${
                    row.hidden ? "text-on-surface-variant" : ""
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-surface-container ${
                          row.hidden ? "opacity-50 grayscale" : ""
                        }`}
                      >
                        {row.imageUrl ? (
                          <Image
                            src={row.imageUrl}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-outline">
                            <CampaignIcon className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {row.href ? (
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-md items-center gap-1 font-medium text-on-surface hover:text-primary-container hover:underline"
                          >
                            <span className="line-clamp-1">{row.title}</span>
                            <OpenInNewIcon className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="line-clamp-1 max-w-md font-medium text-on-surface">
                            {row.title}
                          </span>
                        )}
                        {row.gone && (
                          <p className="text-caption text-on-surface-variant">
                            ไม่อยู่ในรายการล่าสุดของ csmju.com
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <span className="inline-block whitespace-nowrap rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
                      {KIND_LABEL[row.kind]}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                    {row.date ? formatDate(row.date) : "—"}
                  </td>
                  <td className={tdClass}>
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-label-sm ${
                        row.hidden ? "text-outline" : "text-success"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full ${
                          row.hidden ? "bg-outline" : "bg-success"
                        }`}
                      />
                      {row.hidden ? "ซ่อนอยู่" : "แสดง"}
                    </span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={busyKey !== null}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {row.hidden ? (
                        <EyeIcon className="h-4 w-4" />
                      ) : (
                        <EyeOffIcon className="h-4 w-4" />
                      )}
                      {busy ? "กำลังบันทึก…" : row.hidden ? "แสดง" : "ซ่อน"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
