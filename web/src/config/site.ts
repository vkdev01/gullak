export const site = {
  name: "Gullak",
  tagline: "A ledger detailed enough for an accountant.",
  description: "MVP 0 — accounts, categories and a ledger you can trust, before any agent touches it.",
  repoUrl: "https://github.com/vkdev01/gullak",
};

export const navItems = [
  { href: "/", label: "Ledger" },
  { href: "/import/", label: "Import" },
  { href: "/review/", label: "Review" },
  { href: "/accounts/", label: "Accounts" },
  { href: "/login/", label: "Sign in" },
] as const;
