"use client";

import s from "./ledger.module.scss";

const KEYS: [string, string][] = [
  ["j / k", "Next / previous row"],
  ["Enter", "Open the row"],
  ["e", "Change the row's category"],
  ["/", "Search"],
  ["n", "Quick add"],
  ["[ / ]", "Previous / next month"],
  ["⌘K", "Jump anywhere"],
  ["?", "Show or hide this"],
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <aside className={s.help} aria-label="Keyboard shortcuts">
      <div className={s.helpHead}>
        <b>Keyboard</b>
        <button type="button" className={s.drawerClose} onClick={onClose} aria-label="Close shortcuts">
          ×
        </button>
      </div>
      <dl>
        {KEYS.map(([key, what]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
