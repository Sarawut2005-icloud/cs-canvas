# api-conventions.md

**Version:** 1.2 · **Applies to:** All APIs exposed by every subsystem

> This document standardises API conventions across all subsystems so automated checks can verify compliance
> and every AI Engineer produces APIs in a consistent shape.
> Every rule here is enforced in `conformance/` at level L2.

---

## ⚡ Quick Reference (Start here — the full picture at a glance)

| Topic | Rule |
|---|---|
| **URL** | `/api/v1/<noun-plural-kebab>` e.g. `/api/v1/borrow-records` |
| **Create** | `POST` → `201` |
| **List** | `GET` → `200` + `data[]` + `meta{}` |
| **Single item** | `GET /:id` → `200` + `data{}` |
| **Update** | `PATCH /:id` → `200` + `data{}` |
| **Delete** | `DELETE /:id` → `200` + `{ id, deleted: true }` (**never `204`**) |
| **JSON fields** | Always `camelCase` (`studentCode`, `createdAt`) |
| **Timestamps** | ISO 8601 UTC ending in `Z` e.g. `"2026-09-11T09:30:00.000Z"` |
| **Every response** | Wrapped in `{ success, data }` — no exceptions |
| **Error** | `{ success: false, error: { code, message, details } }` |
| **Unknown envelope keys** | Clients ignore them (Core Hub adds `requestId`, `timestamp`, `path`, `error.statusCode`) |
| **Pagination** | `?page=1&limit=20` · max `limit=100` |
| **Path params** | UUID v4 for your own ids · a Core Hub code matches `^[A-Z0-9-]{1,50}$` · anything else → `400` |
| **Caller identity** | `sub` → `coreUserId` — an opaque string, **not always a UUID** |
| **Data from Core Hub** | Reference data, people and images: [`reference-data.md`](reference-data.md) |
| **Public endpoints** | `GET /api/health` · `GET /auth/login` · `GET /auth/callback` · `POST /auth/logout` only |
| **Auth header** | `Authorization: Bearer <token>` |
| **No token** | `401 UNAUTHORIZED` |
| **Wrong permission** | `403 FORBIDDEN` |
| **Too many requests** | `429 TOO_MANY_REQUESTS` + `Retry-After` (seconds) |
| **Dependency temporarily down** | `503 SERVICE_UNAVAILABLE` + `Retry-After` (seconds) — never for a bug |

---

## 1. URL Structure

```text
https://<subsystem-domain>/api/v1/<resource>[/<id>][/<sub-resource>]
```

### URL Rules

| Rule | ✅ Correct | ❌ Wrong |
|---|---|---|
| Plural noun + kebab-case | `/api/v1/borrow-records` | `/api/v1/borrowRecord`, `/api/v1/getBorrowRecord` |
| No verbs in path | `POST /api/v1/enrollments` | `POST /api/v1/createEnrollment` |
| Special actions → sub-resource of id | `POST /api/v1/borrow-records/:id/return` | `POST /api/v1/returnBorrowRecord` |
| Max 1 level of nesting | `/api/v1/students/:id/enrollments` | `/api/v1/students/:id/courses/:id/grades` |
| No trailing slash | `/api/v1/students` | `/api/v1/students/` |
| Path params must be UUID v4 | `/api/v1/students/550e8400-...` | `/api/v1/students/12345` → must respond `400` |
| Exception: a path param that is a Core Hub code matches `^[A-Z0-9-]{1,50}$` | `/api/v1/rooms/LAB-1/schedule` | `/api/v1/rooms/lab%201` → must respond `400 VALIDATION_ERROR` |
| Query params in camelCase | `?studentId=&status=&page=` | `?student_id=&Status=` |

### Endpoints outside `/api/v1/` (exactly 4 paths)

| Path | Reason |
|---|---|
| `GET /api/health` | Used for monitoring · not version-bound · public |
| `GET /auth/login` | Starts every sign-in and mints the `state` ([auth-contract](auth-contract.md) 5.2) · public · redirect only, no form |
| `GET /auth/callback` | Must match the `callback_url` registered with Core Hub · public |
| `POST /auth/logout` | Clears this subsystem's cookies, then `303` to Core Hub `/logout` · public |

### Versioning

- **Breaking change** (removing/renaming a field, changing status semantics) → release as `/api/v2` and keep `v1` alive for at least 1 semester
- **Non-breaking change** (adding a field or endpoint) → ship directly, no version bump needed

---

## 2. HTTP Methods and Status Codes

| Method | Purpose | Success status | Notes |
|---|---|---|---|
| `GET /api/v1/<res>` | List | `200` | Must have a deterministic sort order |
| `GET /api/v1/<res>/:id` | Single item | `200` | Not found → `404` |
| `POST /api/v1/<res>` | Create | **`201`** | Business rule conflict → `409` |
| `PATCH /api/v1/<res>/:id` | Partial update | `200` | Send only fields you want to change |
| `DELETE /api/v1/<res>/:id` | Delete | `200` | **Never `204`** — envelope is always required |
| `PUT` | Full replacement | `200` | **Avoid** — prefer `PATCH` |

---

## 3. Response Format — Success

**Every response must be wrapped in the envelope** — regardless of whether it's GET, POST, or DELETE.

### Single object

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "studentCode": "64010001",
    "fullName": "John Doe",
    "createdAt": "2026-09-11T09:30:00.000Z"
  }
}
```

### Collection (must always include `meta`)

```json
{
  "success": true,
  "data": [
    { "id": "550e8400-...", "studentCode": "64010001" },
    { "id": "661f9511-...", "studentCode": "64010002" }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Successful DELETE

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deleted": true
  }
}
```

> Allowed top-level keys: `success`, `data`, `meta` only.

**Clients must ignore keys they do not know** — in success and error bodies alike. Core Hub adds `requestId` and
`timestamp` to every success body, and `path`, `timestamp` and `error.statusCode` to every error body; a client that
rejects an extra key breaks the next time a server adds one.

---

## 4. Response Format — Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      "quantity must be greater than 0",
      "returnDate must be a valid ISO 8601 date"
    ]
  }
}
```

### Error Codes (closed list — use only these)

`error.code` must be SCREAMING_SNAKE_CASE and must be one of the following values.
(Conformance reads the canonical list from [`../contracts/error-codes.json`](../contracts/error-codes.json))

| code | HTTP | When to use | Example |
|---|---|---|---|
| `BAD_REQUEST` | 400 | Malformed request in general | Wrong method, bad path |
| `VALIDATION_ERROR` | **400** | body/query fails validation | Missing field, wrong type, value out of range |
| `UNAUTHORIZED` | 401 | Caller identity unknown | No token / expired token |
| `FORBIDDEN` | 403 | Identity known but insufficient permission | Student calling an admin endpoint |
| `NOT_FOUND` | 404 | Resource does not exist | `:id` not in database |
| `CONFLICT` | 409 | Business rule violation | Borrowing an item already on loan |
| `TOO_MANY_REQUESTS` | 429 | Caller exceeded a rate limit | Same address or user sending faster than the ceiling |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Unhandled exception |
| `SERVICE_UNAVAILABLE` | 503 | Something this service depends on is temporarily unavailable | Database connection pool full (Prisma `P2024`) |

**429 and 503 must carry a `Retry-After` header**, in whole seconds (at least `1`), so a client knows how long to back off.

**503 is for a dependency that is temporarily unavailable** — the database pool is full, an upstream is restarting. It is never a substitute for `500` when the cause is a bug: `503` tells clients to retry the same request, which only repeats a bug.

**Core Hub is such a dependency.** When it times out, answers `5xx` or `429` and there is no stale cache to serve, answer `503 SERVICE_UNAVAILABLE` with `Retry-After`; when it answers `401`, answer `401 UNAUTHORIZED` so the user goes through SSO again — never `503` ([`reference-data.md`](reference-data.md) 7.4). Decide by the HTTP status: Core Hub reports every `5xx` with `error.code = "INTERNAL_ERROR"`.

> Use `VALIDATION_ERROR` with **400**, not 422 — this matches NestJS `ValidationPipe` defaults so no custom exception filter is needed.

**Never leak the following in a response:**
- Stack traces
- Server file paths or filenames
- Raw ORM or SQL error messages (e.g. `duplicate key value violates unique constraint`)

---

## 5. Pagination

```text
GET /api/v1/students?page=1&limit=20
```

- Defaults: `page=1`, `limit=20`
- Maximum: `limit=100`
- Non-numeric `limit` or value out of range → `400 VALIDATION_ERROR`
- **Empty collection** → return `data: []` + `meta.total: 0` (never `null`, never `404`)

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

---

## 6. Field Naming

| Layer | Format | Examples |
|---|---|---|
| JSON output from API | **camelCase** | `studentCode`, `createdAt`, `coreUserId` |
| OAuth fields | `snake_case` (international standard) | `access_token`, `token_type`, `expires_in` |
| Database columns | **snake_case** | `student_code`, `created_at` |

- Timestamps must use **ISO 8601 UTC** ending in `Z` — `"2026-09-11T09:30:00.000Z"`
- Every id your subsystem creates must be **UUID v4**
- `coreUserId` (the JWT `sub`) is **an opaque string of up to 64 characters, not always a UUID** — CSV-imported students are `user-<studentCode>`. Store it as text and never parse or validate it as a UUID
- Data owned by Core Hub is referenced by its `code` (`roomCode`, `termCode`, ...), never by an id — Core Hub does not expose ids ([`reference-data.md`](reference-data.md) 8)
- Field names that match shared variables must exactly follow `data-dictionary.md` — no renaming

---

## 7. Security — Authentication

### 7.1 Token format

Every request to `/api/v1/` must include a JWT token issued by Core Hub in the `Authorization` header:

```http
Authorization: Bearer <jwt-token>
```

No token, wrong format, or expired token → respond `401 UNAUTHORIZED` immediately. Do not process the request.

### 7.2 How to validate the token (NestJS)

Copy the auth layer of the reference implementation (`demo-student-subsystem/backend/src/auth/`) — do not write your
own JWT validation logic. Its `CoreHubJwtGuard` runs the 10 checks of [`auth-contract.md`](auth-contract.md) §4
(`jose` + JWKS by `kid`, rule `SEC-04`) and is registered globally, so every route is protected by default.

```ts
// app.module.ts — as in the reference implementation
import { APP_GUARD } from "@nestjs/core";
import { CoreHubJwtGuard } from "./auth/guards/core-hub-jwt.guard";
import { PermissionsGuard } from "./auth/guards/permissions.guard";

@Module({
  providers: [
    { provide: APP_GUARD, useClass: CoreHubJwtGuard },   // 401 — who is it?
    { provide: APP_GUARD, useClass: PermissionsGuard },  // 403 — may they?
  ],
})
export class AppModule {}
```

To make a specific route public, use the `@Public()` decorator (and list it in `public_endpoints` of `subsystem.yaml`):

```ts
import { Public } from "./auth/decorators/public.decorator";

@Public()
@Get("health")          // served at /api/health
health() {
  return { status: "ok", service: "csmju-equipment" };   // the response interceptor adds the envelope
}
```

### 7.3 Reading the caller's identity

After validation, the guard puts the verified identity on the request; read it with `@CurrentUser()`:

```ts
import { CurrentUser } from "./auth/decorators/current-user.decorator";
import type { CoreHubIdentity } from "./auth/core-hub-identity";

@Get("v1/borrow-records")
findAll(@CurrentUser() user: CoreHubIdentity) {
  user.id;             // claim sub — opaque string, not always a UUID; store it as core_user_id
  user.coreRole;       // e.g. "student", "lecturer" — the role for this subsystem
  user.subsystemRole;  // after the role mapping, e.g. STUDENT
  user.email;          // display only — never a key (the student code is not in the token)
}
```

### 7.4 Role-based access (FORBIDDEN vs UNAUTHORIZED)

| Situation | Response |
|---|---|
| No token / invalid token / expired | `401 UNAUTHORIZED` — caller identity unknown |
| Valid token but role not allowed | `403 FORBIDDEN` — identity known, permission denied |

Access is granted by permission, not by comparing role names ([`authorization.md`](authorization.md) §4):

```ts
import { RequirePermissions } from "./auth/decorators/require-permissions.decorator";
import { Permission } from "./auth/permissions";

@RequirePermissions(Permission.BORROW_RECORD_DELETE_ANY)   // roles without it get 403
@Delete("v1/borrow-records/:id")
remove(@Param("id") id: string) { … }
```

### 7.5 Error responses

**401 — No token or invalid token:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid token"
  }
}
```

**403 — Valid token but insufficient role:**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action"
  }
}
```

### 7.6 Public endpoints declaration

Endpoints accessible without a token must be declared in `subsystem.yaml`:

```yaml
public_endpoints:
  - GET /api/health
  - GET /auth/login
  - GET /auth/callback
  - POST /auth/logout
```

> If not declared, conformance will fail — the system assumes the endpoint is protected.

---

## 8. Health Check (required for every subsystem)

```http
GET /api/health
```

**Expected response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "csmju-equipment"
  }
}
```

- `data.service` must exactly match `name` in `subsystem.yaml`
- `data.service` must exactly match the `name` registered with Core Hub
- This endpoint is public — no token required

> Core Hub itself uses `/api/v1/health` (versioned), which is a Core Hub–only exception. All other subsystems use `/api/health`.

---

## 9. Anti-patterns — What Not to Do

Common mistakes that will cause an immediate PR rejection.

### ❌ Verb in URL

```text
POST /api/v1/createEnrollment     ← wrong
POST /api/v1/enrollments          ← correct
```

### ❌ Response without envelope

```json
// wrong — raw data with no wrapper
{ "id": "abc", "name": "Test" }

// correct
{ "success": true, "data": { "id": "abc", "name": "Test" } }
```

### ❌ DELETE returning 204

```text
DELETE /api/v1/students/:id → 204 No Content   ← wrong
DELETE /api/v1/students/:id → 200 + { id, deleted: true }   ← correct
```

### ❌ Empty collection returning 404

```text
GET /api/v1/students?status=inactive → 404   ← wrong (query is valid, data just doesn't exist)
GET /api/v1/students?status=inactive → 200 + data:[] + meta   ← correct
```

### ❌ Leaking raw error messages

```json
// wrong — exposes internal structure
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "duplicate key value violates unique constraint \"students_student_code_key\""
  }
}

// correct
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Student code already exists"
  }
}
```

### ❌ Writing custom JWT validation instead of using the SDK

```ts
// wrong — never do this
const token = request.headers.authorization?.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// correct — use the shared guard from Core Hub SDK
// JwtAuthGuard applied globally in AppModule handles this automatically
```

### ❌ Returning 403 when the token is missing

```json
// wrong — no token means identity is unknown → 401
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Access denied" } }

// correct — no token → 401, wrong role → 403
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid token" } }
```

### ❌ snake_case JSON fields

```json
// wrong
{ "student_code": "64010001", "created_at": "2026-09-11T09:30:00.000Z" }

// correct
{ "studentCode": "64010001", "createdAt": "2026-09-11T09:30:00.000Z" }
```

---

## 10. Not Yet in the Current Architecture

| Topic | Status |
|---|---|
| API Gateway / rate limit headers (`X-RateLimit-*`) | ❌ Not available — do not design assuming these exist. A throttled request answers `429` with `Retry-After` only (see section 4) |
| Cross-subsystem calls (service-to-service) | ❌ No contract yet — must go through the Change Process first |

---

## 11. PR Merge Checklist

> Run through this before every push — conformance checks all of these automatically.

- [ ] URL uses plural noun + kebab-case + lives under `/api/v1/`
- [ ] No verbs in the URL path
- [ ] `POST` returns `201` · `DELETE` returns `200` + `{ id, deleted: true }` (not `204`)
- [ ] Every response is wrapped in `{ success, data[, meta] }` or `{ success: false, error }`
- [ ] `error.code` is from the closed list only · `VALIDATION_ERROR` uses HTTP 400
- [ ] Collections include `meta { total, page, limit, totalPages }` and support `?page=&limit=`
- [ ] Empty collections return `data: []` + `meta.total: 0`, not `404`
- [ ] JSON response fields are camelCase · DB columns are snake_case
- [ ] Timestamps are ISO 8601 UTC ending in `Z`
- [ ] Every id the subsystem creates is UUID v4 · a path param is a UUID or a Core Hub code (`^[A-Z0-9-]{1,50}$`) · anything else responds `400`
- [ ] `coreUserId` is stored as text and never validated as a UUID
- [ ] Clients ignore unknown envelope keys · Core Hub down without a cache → `503 SERVICE_UNAVAILABLE` + `Retry-After`
- [ ] No stack trace / SQL error / file path leaking in any response
- [ ] `CoreHubJwtGuard` applied globally in `AppModule` — no route under `/api/v1/` is accidentally public
- [ ] Public endpoints use `@Public()` decorator and are declared in `subsystem.yaml`
- [ ] No token → `401 UNAUTHORIZED` · wrong role → `403 FORBIDDEN` (not swapped)
- [ ] No custom JWT parsing — the auth layer is copied from the reference implementation (`jose` + JWKS)
- [ ] `GET /api/health` exists · `data.service` matches the system name in `subsystem.yaml`
- [ ] `public_endpoints` declared in `subsystem.yaml` completely
- [ ] `node standards/conformance/run.js` passes at L2 or above
