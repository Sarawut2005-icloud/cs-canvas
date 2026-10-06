"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { PAGE_SIZES } from "../../lib/paging";
import { inputClass } from "./ui";

/**
 * "แสดงหน้าละ n" — writes `?limit=` into the URL (keeping every other
 * filter) and drops `page` so the user lands on page 1 of the new size.
 */
export default function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = useId();

  const change = (limit: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("limit", limit);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <label htmlFor={id} className="flex items-center gap-2 whitespace-nowrap">
      <span>แสดงหน้าละ</span>
      <select
        id={id}
        value={String(value)}
        onChange={(event) => change(event.target.value)}
        className={`${inputClass} w-auto py-1.5`}
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span>รายการ</span>
    </label>
  );
}
