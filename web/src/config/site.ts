export const site = {
  name: "Gullak",
  tagline: "A ledger detailed enough for an accountant.",
  description: "MVP 0 — accounts, categories and a ledger you can trust, before any agent touches it.",
  repoUrl: "https://github.com/vkdev01/gullak",
};

export type NavItem = { href: string; label: string };

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Money",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/ledger/", label: "Ledger" },
      { href: "/review/", label: "Review" },
      { href: "/import/", label: "Import" },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/budgets/", label: "Budgets" },
      { href: "/goals/", label: "Goals" },
    ],
  },
  {
    label: "Setup",
    items: [{ href: "/accounts/", label: "Accounts" }],
  },
];
