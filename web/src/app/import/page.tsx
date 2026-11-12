"use client";

import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useImport } from "@/hooks/useImport";
import ImportPreview from "@/components/import/ImportPreview";
import ImportResult from "@/components/import/ImportResult";
import StatementForm from "@/components/import/StatementForm";
import s from "./page.module.scss";

export default function ImportPage() {
  const { accounts } = useAccounts();
  const { leaves } = useCategories();
  const importer = useImport();


  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Import a statement</h1>
        <p>
          Two phases, on purpose: the preview shows exactly what will be added, what is already in the ledger, and
          what the importer is unsure about. Nothing is written until you commit.
        </p>
      </header>

      {importer.error && <p className={s.error}>{importer.error}</p>}

      {importer.result ? (
        <ImportResult batch={importer.result} onReset={importer.reset} />
      ) : importer.preview ? (
        <ImportPreview
          preview={importer.preview}
          categories={leaves}
          willImport={importer.willImport}
          busy={importer.busy}
          onCategory={importer.setCategory}
          onSkip={importer.skip}
          onCommit={importer.commit}
          onCancel={importer.reset}
        />
      ) : (
        <StatementForm accounts={accounts} busy={importer.busy} onPreview={importer.runPreview} />
      )}
    </main>
  );
}
