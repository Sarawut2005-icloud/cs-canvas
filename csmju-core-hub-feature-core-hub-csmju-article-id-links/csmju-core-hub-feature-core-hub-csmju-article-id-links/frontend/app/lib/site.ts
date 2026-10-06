/**
 * The department's public details for every footer (portal and public
 * pages) — one place to edit them. Organisational contacts only, from the
 * department record in the registry; never a person's details.
 */
export const SITE = {
  nameTh: "สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้",
  nameEn: "Computer Science, Maejo University",
  address:
    "ชั้น 6 อาคาร 60 ปี คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ 63 หมู่ 4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290",
  /**
   * Opens Google Maps in a new tab. A link, never an embedded map: the
   * pages load nothing from other sites (ui-design-system §15, §16.2).
   */
  mapUrl: "https://maps.app.goo.gl/y2Xn7d3w5zV2bKj59",
  contacts: [
    { label: "โทรศัพท์", value: "053-873890-3", href: "tel:053873890" },
    { label: "โทรสาร", value: "053-873898", href: null },
    { label: "อีเมล", value: "cs@mju.ac.th", href: "mailto:cs@mju.ac.th" },
  ],
  relatedSites: [
    { label: "เว็บไซต์สาขาวิชา (csmju.com)", href: "https://csmju.com" },
    { label: "มหาวิทยาลัยแม่โจ้", href: "https://www.mju.ac.th" },
    { label: "งานทะเบียน (reg.mju.ac.th)", href: "https://reg.mju.ac.th" },
  ],
} as const;
