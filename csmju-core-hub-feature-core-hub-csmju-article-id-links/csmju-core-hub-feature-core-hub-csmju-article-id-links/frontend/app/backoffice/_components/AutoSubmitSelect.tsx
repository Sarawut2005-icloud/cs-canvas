"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * A <select> inside a GET filter form that applies itself on change, so the
 * user does not also have to press "ค้นหา" to see the effect.
 */
export default function AutoSubmitSelect(
  props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange">,
) {
  return (
    <select
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    />
  );
}
