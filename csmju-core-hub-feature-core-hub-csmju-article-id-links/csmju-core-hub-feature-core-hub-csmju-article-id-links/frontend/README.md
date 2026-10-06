# CSMJU Portal (frontend)

Next.js frontend for the CSMJU Core Hub. Every request to the NestJS Core API
happens **server-side** — route handlers, server components and `proxy.ts` — so the
JWT lives in an httpOnly cookie and never reaches client-side JavaScript.

## Getting Started

1. Start the Core API (`cd ../backend && npm run start:dev`, default `http://127.0.0.1:3000`).
2. Copy `.env.example` to `.env.local` and point `BACKEND_API_URL` at it.
3. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## How the frontend talks to the backend

| Piece | Responsibility |
| --- | --- |
| `app/lib/backend.ts` | `BACKEND_URL`, `refreshTokens()`, cookie set/clear helpers. Edge-safe — no `next/headers`. |
| `app/lib/api.ts` | `apiFetch()` attaches the access token and unwraps the `{ success, data }` envelope; `getCurrentUser()`, `getUsers()`, `getHealth()`. |
| `app/lib/session.ts` | JWT decoding (claims are `sub`/`sid`), role helpers, `logout()`. |
| `app/api/auth/{login,refresh,logout}` | Proxy the Core API and own the `csmju_access_token` / `csmju_refresh_token` cookies. |
| `proxy.ts` | Rotates an expired access token via `POST /auth/refresh` before the page renders, redirects anonymous visitors to `/login`, keeps `/backoffice` to staff/admin. |

Layouts re-verify the session against `GET /auth/me`, and the Core API enforces
permissions on every call — the cookie check in `proxy.ts` only decides navigation.

Backend endpoints currently consumed: `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/logout`, `GET /auth/me`, `GET /users`, `GET /subsystems/all` (+ the
subsystem status actions) and `GET /health`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
