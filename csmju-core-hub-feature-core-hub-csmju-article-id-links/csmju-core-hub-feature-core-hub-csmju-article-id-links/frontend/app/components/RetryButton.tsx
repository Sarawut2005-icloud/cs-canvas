"use client";

import { useRouter } from "next/navigation";

/** "ลองอีกครั้ง" for an error state: renders the page's server data again. */
export default function RetryButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="rounded-lg px-3 py-1.5 text-label-md text-primary-container hover:bg-primary-container/10"
    >
      ลองอีกครั้ง
    </button>
  );
}
