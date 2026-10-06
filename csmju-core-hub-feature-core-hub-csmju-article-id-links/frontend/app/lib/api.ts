import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ACCESS_TOKEN_COOKIE, type SessionUser, type UserRole } from "./session";
import { BACKEND_URL, forwardedFor } from "./backend";
import { ApiError, type ApiErrorCode } from "./api-error";

// Re-exported so existing imports keep working; the class itself lives in a
// module without `next/headers` so client components can use it too.
export { ApiError, type ApiErrorCode };

type ApiEnvelope<T> =
  | { success: true; data: T; meta?: PageMeta }
  | {
      success: false;
      error: {
        code?: ApiErrorCode;
        message: string;
        statusCode?: number;
        details?: string[];
      };
    };

export type PageMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Server-only fetch helper: attaches the caller's access token and unwraps
 * the `{ success, data }` / `{ success: false, error }` envelope every
 * Core API response uses.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetchEnvelope<T>(path, init)).data;
}

/** Like `apiFetch` but keeps `meta` — for paginated collections. */
export async function apiFetchPage<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T[]; meta: PageMeta }> {
  const body = await apiFetchEnvelope<T[]>(path, init);
  return {
    data: body.data,
    meta: body.meta ?? {
      total: body.data.length,
      page: 1,
      limit: body.data.length,
      totalPages: 1,
    },
  };
}

async function apiFetchEnvelope<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta?: PageMeta }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const incoming = await headers();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...forwardedFor(incoming),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      `ไม่สามารถเชื่อมต่อ Core API ที่ ${BACKEND_URL} ได้`,
      503,
      "INTERNAL_ERROR",
    );
  }

  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !body?.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new ApiError(
      error?.message ?? `Request to ${path} failed with ${res.status}`,
      res.status,
      error?.code,
      error?.details,
    );
  }

  return { data: body.data, meta: body.meta };
}

/** Runs `apiFetch` and returns `null` when the call fails. */
export async function apiFetchOrNull<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, init);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export type ApiUser = {
  id: string;
  email: string;
  username?: string | null;
  role: { id: string; name: UserRole };
  /** Permissions given to this account on top of its role (admin view). */
  permissionGrants?: { permission: string }[];
  createdAt: string;
  updatedAt: string;
};

export type ApiHealth = {
  status: string;
  uptime?: number;
  timestamp?: string;
  [key: string]: unknown;
};

/** GET /auth/me — the signed-in user, verified by the backend. */
export function getCurrentUser(): Promise<SessionUser | null> {
  return apiFetchOrNull<SessionUser>("/auth/me");
}

/** GET /users — requires the `user:read` permission. */
export function getUsers(q?: string): Promise<ApiUser[]> {
  return apiFetch<ApiUser[]>(`/users${toQuery({ q })}`);
}

/* ------------------------------------------------------------------ */
/* Subsystem Registry                                                  */
/* ------------------------------------------------------------------ */

export type SubsystemCategory =
  | "LEARNING"
  | "CODING"
  | "CAREER_ACTIVITY"
  | "COMMUNITY"
  | "STUDENT_SERVICE"
  | "TOOLS"
  | "OTHER";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type LifecycleStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type ExceptionStatus = "REQUESTED" | "APPROVED" | "REJECTED";

/** A Core Hub account as the registry references it (owner, reviewer, actor). */
export type AccountRef = { id: string; username: string | null; email: string };

export type Subsystem = {
  id: string;
  name: string;
  displayName: string;
  ownerId: string;
  owner?: AccountRef;
  repo: string;
  standardsVersion: string;
  callbackUrl: string;
  /** Origin the Monitor probes at `<baseUrl>/api/health`; null = not set. */
  baseUrl: string | null;
  /** Group in the portal's subsystem menu. */
  category: SubsystemCategory;
  /** One line for users; null when the owner has not written one. */
  description: string | null;
  /** false hides it from every user's menu (admin decides). */
  listedInMenu: boolean;
  defaultRoleMapping: Record<string, string>;
  approvalStatus: ApprovalStatus;
  status: LifecycleStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubsystemException = {
  id: string;
  subsystemId: string;
  username: string;
  role: string;
  reason: string;
  status: ExceptionStatus;
  createdAt: string;
};

export type SubsystemEvent = {
  id: string;
  action:
    | "SUBMITTED"
    | "UPDATED"
    | "APPROVED"
    | "REJECTED"
    | "RESUBMITTED"
    | "ACTIVATED"
    | "DEACTIVATED"
    | "SUSPENDED"
    | "EXCEPTION_REQUESTED"
    | "EXCEPTION_APPROVED"
    | "EXCEPTION_REJECTED"
    | "CHANGE_REQUESTED"
    | "CHANGE_APPROVED"
    | "CHANGE_REJECTED"
    | "CHANGE_CANCELLED";
  reason: string | null;
  /** `{ field: { from, to } }` — only the fields that changed. */
  changes?: FieldChanges | null;
  createdAt: string;
  actor: AccountRef;
};

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

/** The fields an owner changes through a change request once approved. */
export type ChangeRequestValues = Partial<{
  callbackUrl: string;
  baseUrl: string | null;
  defaultRoleMapping: Record<string, string>;
}>;

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ChangeRequest = {
  id: string;
  subsystemId: string;
  requestedById: string;
  /** The requested new values. */
  changes: ChangeRequestValues;
  status: ChangeRequestStatus;
  reason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: AccountRef;
  reviewedBy: AccountRef | null;
};

export type ChangeRequestWithSubsystem = ChangeRequest & {
  subsystem: Pick<
    Subsystem,
    "id" | "name" | "displayName" | "callbackUrl" | "baseUrl" | "defaultRoleMapping"
  >;
};

export type SubsystemDetail = Subsystem & {
  owner: AccountRef;
  reviewedBy: AccountRef | null;
  exceptions: SubsystemException[];
  events: SubsystemEvent[];
  /** The request waiting for an administrator, if any (one at a time). */
  pendingChangeRequest: ChangeRequest | null;
};

export type SubsystemSummary = {
  total: number;
  pending: number;
  rejected: number;
  active: number;
  inactive: number;
  suspended: number;
  pendingExceptions: number;
  /** Change requests awaiting review — reviewers only, 0 for everyone else. */
  pendingChangeRequests?: number;
};

export type ExceptionRequest = SubsystemException & {
  subsystem: Pick<Subsystem, "id" | "name" | "displayName">;
};

/** A live subsystem the signed-in user may enter (sidebar entries). */
export type DirectoryEntry = Pick<
  Subsystem,
  "id" | "name" | "displayName" | "category" | "description" | "defaultRoleMapping"
>;

export type SubsystemListFilter = {
  approvalStatus?: ApprovalStatus;
  status?: LifecycleStatus;
  q?: string;
  page?: number;
  limit?: number;
};

export type QueryParams = Record<string, string | number | boolean | undefined>;

export function toQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /subsystems — staff get only their own; admins get everything. */
export function listSubsystems(filter: SubsystemListFilter = {}) {
  return apiFetchPage<Subsystem>(`/subsystems${toQuery(filter)}`);
}

/** GET /subsystems/summary — counts for the summary cards. */
export function getSubsystemSummary(): Promise<SubsystemSummary> {
  return apiFetch<SubsystemSummary>("/subsystems/summary");
}

/** GET /subsystems/:id — detail with owner, exceptions and history. */
export function getSubsystem(id: string): Promise<SubsystemDetail> {
  return apiFetch<SubsystemDetail>(`/subsystems/${encodeURIComponent(id)}`);
}

/** GET /subsystems/change-requests — change requests awaiting review (admin). */
export function listPendingChangeRequests(page = 1) {
  return apiFetchPage<ChangeRequestWithSubsystem>(
    `/subsystems/change-requests${toQuery({ status: "PENDING", page, limit: 50 })}`,
  );
}

/**
 * GET /subsystems/standards-versions — released csmju2030-standards versions,
 * newest first. The Core API reads GitHub and caches; the browser never does.
 */
export async function getStandardsVersions(): Promise<string[]> {
  const list = await apiFetchOrNull<{ versions: string[] }>(
    "/subsystems/standards-versions",
  );
  return list?.versions ?? [];
}

/** GET /subsystem-exceptions — exception requests awaiting review (admin). */
export function listExceptionRequests(page = 1) {
  return apiFetchPage<ExceptionRequest>(
    `/subsystem-exceptions${toQuery({ status: "REQUESTED", page, limit: 50 })}`,
  );
}

/**
 * Subsystems this user may actually enter, for the sidebar.
 *
 * `GET /subsystems/directory` already narrows the registry to what is live
 * (`APPROVED` + `ACTIVE`) and to subsystems whose `defaultRoleMapping` lists
 * the caller's core role — the same rule the Core API enforces before it
 * redirects, so a link that would 403 is never rendered in the first place.
 *
 * Returns [] instead of throwing — a registry hiccup must not take the whole
 * navigation down.
 */
export async function getLinkedSubsystems(): Promise<DirectoryEntry[]> {
  const entries = await apiFetchOrNull<DirectoryEntry[]>(
    "/subsystems/directory",
  );

  return (entries ?? []).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "th"),
  );
}

/* ------------------------------------------------------------------ */
/* Monitor — GET /subsystems/:id/health (probed server-side by the API)  */
/* ------------------------------------------------------------------ */

export type SubsystemHealth = {
  status: "UP" | "DOWN" | "NO_BASE_URL";
  httpStatus?: number;
  latencyMs?: number;
  service?: string;
  /** false = the subsystem answers, but not with the registered `name`. */
  serviceMatches?: boolean;
  checkedAt: string;
  error?: string;
  /** true = answered from the API's 3-second cache, no new probe. */
  cached?: boolean;
};

export function getSubsystemHealth(id: string): Promise<SubsystemHealth> {
  return apiFetch<SubsystemHealth>(
    `/subsystems/${encodeURIComponent(id)}/health`,
  );
}

/* ------------------------------------------------------------------ */
/* People — /people (staff read, admin manages)                          */
/* ------------------------------------------------------------------ */

export type PersonType = "STUDENT" | "STAFF";
export type PersonStatus = "ACTIVE" | "INACTIVE" | "GRADUATED";
export type StaffType = "LECTURER" | "OFFICER" | "TECHNICIAN" | "OTHER";

export type Person = {
  personCode: string;
  personType: PersonType;
  staffType: StaffType | null;
  academicTitle: string | null;
  jobTitle: string | null;
  fullNameTh: string;
  fullNameEn: string | null;
  /** Only present for callers with `people:contact:read`. */
  universityEmail?: string | null;
  entryYear: number | null;
  status: PersonStatus;
  coreUserId: string | null;
  faculty: { code: string; nameTh: string };
  department: { code: string; nameTh: string } | null;
  curriculum: { code: string; nameTh: string; curriculumYear: number } | null;
};

export type PeopleFilter = {
  personType?: PersonType;
  /** Omit for ACTIVE only (API default); "ALL" for every status. */
  status?: PersonStatus | "ALL";
  q?: string;
  entryYear?: number | string;
  departmentCode?: string;
  page?: number | string;
  limit?: number;
};

/** GET /people/me — the signed-in user's own record, advisors included. */
export type MyPerson = Person & {
  advisors: { personCode: string; fullNameTh: string; universityEmail: string | null }[];
};

/**
 * `null` when the account is not linked to the registry (or the call fails).
 * Cached per request: the portal layout and its pages both read it.
 */
export const getMyPerson = cache(
  (): Promise<MyPerson | null> => apiFetchOrNull<MyPerson>("/people/me"),
);

export type ScheduleType = "LECTURE" | "LAB" | "OTHER";

/** One weekly class meeting from GET /people/me/schedule. */
export type ClassSession = {
  id: string;
  scheduleType: ScheduleType;
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
  /** "09:00", Thailand time. */
  startTime: string;
  endTime: string;
  /** Whether the user takes this class or teaches it. */
  involvement: "LEARN" | "TEACH";
  termCode: string;
  sectionNo: string;
  course: { code: string; nameTh: string; nameEn: string | null };
  room: { code: string; nameTh: string; buildingNameTh: string } | null;
};

/**
 * The current term's classes; `[]` when there are none, `null` when the
 * call fails (the dashboard shows an error, not "no classes").
 * Cached per request: the layout's bell and the dashboard both read it.
 */
export const getMySchedule = cache(
  (): Promise<ClassSession[] | null> =>
    apiFetchOrNull<ClassSession[]>("/people/me/schedule"),
);

/** GET /people — requires `people:read` (staff/admin). */
export function listPeople(filter: PeopleFilter = {}) {
  return apiFetchPage<Person>(`/people${toQuery(filter)}`);
}

/** GET /people/:code */
export function getPerson(personCode: string): Promise<Person> {
  return apiFetch<Person>(`/people/${encodeURIComponent(personCode)}`);
}

/** GET /people/:code/advisors — active advisors of a student. */
export function getAdvisors(personCode: string): Promise<Person[]> {
  return apiFetch<Person[]>(
    `/people/${encodeURIComponent(personCode)}/advisors`,
  );
}

/**
 * GET /people/:code/advisees — students this lecturer advises, by code.
 * `status` defaults to ACTIVE in the API; "ALL" includes everyone.
 */
export function getAdvisees(
  personCode: string,
  status: PersonStatus | "ALL" = "ACTIVE",
): Promise<Person[]> {
  return apiFetch<Person[]>(
    `/people/${encodeURIComponent(personCode)}/advisees${toQuery({ status })}`,
  );
}

/** PATCH /people/:code body — `people:manage` (admin). */
export type PersonPatch = {
  status?: PersonStatus;
  universityEmail?: string;
  /** Links the person to the Core Hub account with this login email. */
  coreUserEmail?: string;
};

export type ImportRowError = { row: number; message: string };

/** POST /people/import result — dry-run previews, commit writes. */
export type ImportResult =
  | {
      mode: "dry-run";
      total: number;
      toCreate: number;
      toUpdate: number;
      /** Login accounts the commit will create for new ACTIVE students. */
      usersToCreate: number;
      errors: ImportRowError[];
    }
  | {
      mode: "commit";
      total: number;
      created: number;
      updated: number;
      usersCreated: number;
      errors: ImportRowError[];
    };

/* ------------------------------------------------------------------ */
/* Reference data — one contract for every dataset                       */
/* ------------------------------------------------------------------ */

export type ReferenceDataset =
  | "faculties"
  | "departments"
  | "buildings"
  | "rooms"
  | "academic-terms"
  | "courses"
  | "curricula";

export type ReferenceItem = {
  code: string;
  isActive: boolean;
  updatedAt: string;
};

export type Faculty = ReferenceItem & { nameTh: string; nameEn: string };

export type Department = ReferenceItem & {
  nameTh: string;
  nameEn: string;
  facultyCode: string;
  faculty: { code: string; nameTh: string };
};

export type Building = ReferenceItem & {
  nameTh: string;
  nameEn: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RoomType =
  | "LECTURE"
  | "LAB"
  | "SEMINAR"
  | "MEETING"
  | "PROJECT"
  | "OFFICE";

export type Room = ReferenceItem & {
  nameTh: string;
  building: string;
  buildingCode: string;
  floor: number | null;
  capacity: number | null;
  roomType: RoomType;
  facultyCode: string | null;
  photoUrl: string | null;
};

export type AcademicTerm = ReferenceItem & {
  academicYear: number;
  semester: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

/** GET /academic-terms/current — `null` when none is set or the call fails. */
export const getCurrentTerm = cache(
  (): Promise<AcademicTerm | null> => apiFetchOrNull<AcademicTerm>("/academic-terms/current"),
);

export type Course = ReferenceItem & {
  baseCode: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
  creditPattern: string | null;
  departmentCode: string | null;
};

export type Curriculum = ReferenceItem & {
  nameTh: string;
  nameEn: string | null;
  curriculumYear: number;
  totalCredits: number | null;
  departmentCode: string;
};

export type ReferenceFilter = QueryParams & {
  page?: number | string;
  limit?: number;
  includeInactive?: boolean;
  /** true = active only, false = disabled only; wins over includeInactive. */
  isActive?: boolean;
};

/** GET /<dataset> — `reference:read` (every role); admins also POST/PATCH. */
export function listReference<T extends ReferenceItem>(
  dataset: ReferenceDataset,
  filter: ReferenceFilter = {},
) {
  return apiFetchPage<T>(`/${dataset}${toQuery(filter)}`);
}

export function getReference<T extends ReferenceItem>(
  dataset: ReferenceDataset,
  code: string,
): Promise<T> {
  return apiFetch<T>(`/${dataset}/${encodeURIComponent(code)}`);
}

/* ------------------------------------------------------------------ */
/* News — GET /news (content:read, every role)                           */
/* ------------------------------------------------------------------ */

export type NewsArticle = {
  id: string;
  title: string;
  category: string;
  /** `YYYY-MM-DD` */
  publishedOn: string;
  content: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
  department: { code: string; nameTh: string };
  createdAt: string;
  updatedAt: string;
};

export function listNews(params: { page?: number | string; limit?: number } = {}) {
  return apiFetchPage<NewsArticle>(`/news${toQuery(params)}`);
}

export function getNews(id: string): Promise<NewsArticle> {
  return apiFetch<NewsArticle>(`/news/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* Overview — GET /backoffice/summary (system:manage)                    */
/* ------------------------------------------------------------------ */

export type BackofficeSummary = {
  users: { byRole: Record<UserRole, number> };
  people: {
    students: Record<PersonStatus, number>;
    staff: number;
  };
  subsystems: {
    byApproval: Record<ApprovalStatus, number>;
    byStatus: Record<LifecycleStatus, number>;
  };
  currentTerm: { code: string; endDate: string } | null;
  news: { total: number };
};

export function getBackofficeSummary(): Promise<BackofficeSummary> {
  return apiFetch<BackofficeSummary>("/backoffice/summary");
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
  /** Set on the first publish and kept afterwards. */
  publishedAt: string | null;
  /** Set when the announcement has a cover image. */
  imageType: string | null;
  imageUpdatedAt: string | null;
  authorId: string;
  author?: AccountRef;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementListFilter = {
  isPublished?: boolean;
  q?: string;
  page?: number;
  limit?: number;
};

/** GET /announcements — requires `content:update` (staff and admin); includes drafts. */
export function listAnnouncements(filter: AnnouncementListFilter = {}) {
  const { isPublished, ...rest } = filter;
  return apiFetchPage<Announcement>(
    `/announcements${toQuery({
      ...rest,
      isPublished: isPublished === undefined ? undefined : String(isPublished),
    })}`,
  );
}

/* ------------------------------------------------------------------ */
/* Published announcements — public, for the front page                */
/* ------------------------------------------------------------------ */

export type PublishedAnnouncement = Pick<
  Announcement,
  "id" | "title" | "content" | "category" | "imageUpdatedAt"
> & { publishedAt: string };

/** GET /published-announcements — `[]` when the Core API is unreachable. */
export async function listPublishedAnnouncements(
  limit: number,
): Promise<PublishedAnnouncement[]> {
  return (
    (await apiFetchOrNull<PublishedAnnouncement[]>(
      `/published-announcements${toQuery({ limit })}`,
    )) ?? []
  );
}

/** GET /published-announcements/:id — `null` for a draft or unknown id. */
export function getPublishedAnnouncement(
  id: string,
): Promise<PublishedAnnouncement | null> {
  return apiFetchOrNull<PublishedAnnouncement>(
    `/published-announcements/${encodeURIComponent(id)}`,
  );
}

/* ------------------------------------------------------------------ */
/* Notifications — the signed-in user's own                            */
/* ------------------------------------------------------------------ */

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = {
  items: AppNotification[];
  /** Unread notifications overall (`meta.unread`), for the badge. */
  unread: number;
  /** The call failed — the bell shows an error, not "no notifications". */
  failed: boolean;
};

/**
 * GET /notifications — the newest page. Cached per request: the bell shows
 * in the layout and on the dashboard.
 */
export const getMyNotifications = cache(async (): Promise<NotificationList> => {
  try {
    const { data, meta } = await apiFetchPage<AppNotification>(
      "/notifications?limit=20",
    );
    const unread = (meta as PageMeta & { unread?: number }).unread ?? 0;
    return { items: data, unread, failed: false };
  } catch {
    return { items: [], unread: 0, failed: true };
  }
});

/* ------------------------------------------------------------------ */
/* csmju.com items hidden from the front page                          */
/* ------------------------------------------------------------------ */

export type ExternalContentKind = "article" | "banner";

export type HiddenExternalContent = {
  kind: ExternalContentKind;
  /** The item's id on csmju.com. */
  externalId: string;
  /** Title when it was hidden. */
  title: string;
  hiddenAt: string;
};

/**
 * GET /external-content/hidden — public. Returns `[]` when the Core API is
 * unreachable, so the front page shows everything rather than failing.
 */
export const listHiddenExternalContent = cache(
  async (): Promise<HiddenExternalContent[]> =>
    (await apiFetchOrNull<HiddenExternalContent[]>(
      "/external-content/hidden",
    )) ?? [],
);

/** GET /health — public liveness/readiness summary of the Core API. */
export function getHealth(): Promise<ApiHealth | null> {
  return apiFetchOrNull<ApiHealth>("/health");
}

export { BACKEND_URL };
