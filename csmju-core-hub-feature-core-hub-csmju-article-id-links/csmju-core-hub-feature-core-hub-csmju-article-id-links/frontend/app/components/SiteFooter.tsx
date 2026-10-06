import { OpenInNewIcon } from "./icons";
import { SITE } from "../lib/site";

/**
 * Footer of every page — portal, backoffice and the public website. The
 * text lives in `lib/site.ts`. The map is a plain link to Google Maps:
 * nothing from another site loads with the page.
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/40 bg-surface-container-lowest">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3 md:px-12">
        <section>
          <h2 className="mb-3 font-display text-label-md font-bold text-on-surface">
            {SITE.nameTh}
          </h2>
          <p className="text-body-md text-on-surface-variant">{SITE.address}</p>
          <a
            href={SITE.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-label-md text-primary-container hover:underline"
          >
            ดูแผนที่
            <OpenInNewIcon className="h-4 w-4" />
          </a>
        </section>

        <section>
          <h2 className="mb-3 font-display text-label-md font-bold text-on-surface">
            ช่องทางติดต่อ
          </h2>
          <dl className="space-y-1 text-body-md">
            {SITE.contacts.map(({ label, value, href }) => (
              <div key={label} className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="text-on-surface">
                  {href ? (
                    <a href={href} className="hover:text-primary-container hover:underline">
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-3 font-display text-label-md font-bold text-on-surface">
            เว็บไซต์ที่เกี่ยวข้อง
          </h2>
          <ul className="space-y-1 text-body-md">
            {SITE.relatedSites.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-on-surface hover:text-primary-container hover:underline"
                >
                  {label}
                  <OpenInNewIcon className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="border-t border-outline-variant/30 px-4 py-4 text-center text-caption text-on-surface-variant">
        © {year} {SITE.nameEn}
      </p>
    </footer>
  );
}
