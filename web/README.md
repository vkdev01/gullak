# Gullak web

Next.js 15 (App Router) · TypeScript · SCSS modules · static export.

## Structure

```
src/
├── app/                 routes. Thin: they compose components and call hooks.
│   ├── layout.tsx       document shell, fonts, AppShell
│   ├── page.tsx         the ledger
│   ├── accounts/        accounts list
│   └── login/           sign in / sign up
├── components/
│   ├── layout/          AppShell — wordmark, nav, session chrome
│   ├── ui/              Button, Card, Field, StatCard, EmptyState
│   ├── ledger/          QuickAddBar, LedgerToolbar, LedgerList, DayGroup, LedgerRow
│   ├── accounts/        AccountList
│   └── auth/            AuthForm
├── hooks/               useAccounts, useCategories, useLedger, useQuickAdd
├── lib/
│   ├── api/             client (HTTP) · demo (localStorage) · types · index (facade)
│   ├── format.ts        money, dates
│   └── parse.ts         "320 swiggy yesterday"
├── styles/              _tokens · _mixins · globals
└── config/              site metadata and nav items
```

## Conventions

**Components are dumb, hooks are smart.** A component takes props and renders. Anything that
fetches, filters or derives belongs in a hook under `src/hooks`, or in a pure function under
`src/lib`. If a component needs `useEffect` to fetch data, that is a signal to extract a hook.

**One module per component.** `Button.tsx` sits next to `Button.module.scss`. No global component
classes — the only things in `globals.scss` are the reset, base elements and three helpers
(`.num`, `.muted`, `.small`).

**Tokens are the only place a hex value lives.** `styles/_tokens.scss` holds the Sage palette,
radii, shadow, type stack and breakpoints. Modules `@use 'tokens' as t` (resolved through the sass
include path, so the path never depends on how deep the file is).

**Two transports, one interface.** `lib/api/index.ts` exposes `api.*` and picks HTTP or the demo
store from `NEXT_PUBLIC_API_URL`. Nothing else in the app knows which is in play.

**Routes stay shallow.** `app/` holds routing and metadata only. A page that grows past ~80 lines is
usually two components and a hook waiting to be extracted.

## Adding a screen

1. Add the route under `src/app/<name>/page.tsx` and a `page.module.scss`.
2. Add a hook in `src/hooks` if it needs data.
3. Compose from `components/ui` primitives; add a domain component under
   `components/<domain>/` if the markup is reusable.
4. Add the nav entry in `src/config/site.ts`.

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build    # static export into out/
npm start        # serve the export
```

Set `NEXT_PUBLIC_BASE_PATH` when hosting under a sub-path (the Pages workflow does this).
Set `NEXT_PUBLIC_API_URL` to talk to FastAPI; leave it unset to run on the demo store.
