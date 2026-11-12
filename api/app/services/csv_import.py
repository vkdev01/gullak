"""Statement CSV parsing: header detection, row normalisation, dedupe hashing.

Two-phase by design. `build_candidates` produces rows for a preview; nothing is
written to the ledger until the batch is committed, which is what stops the
classic "imported everything twice" failure.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass
from datetime import date, datetime

DATE_KEYS = ("date", "txn date", "transaction date", "value date", "posting date", "tran date")
DESC_KEYS = ("description", "narration", "particulars", "details", "remarks", "transaction remarks", "narrative")
AMOUNT_KEYS = ("amount", "transaction amount", "amt")
DEBIT_KEYS = ("debit", "withdrawal", "withdrawal amt", "withdrawal amt.", "dr", "debit amount")
CREDIT_KEYS = ("credit", "deposit", "deposit amt", "deposit amt.", "cr", "credit amount")
BALANCE_KEYS = ("balance", "closing balance", "running balance")

# Header signatures for the statements people actually upload. First match wins.
TEMPLATES: list[tuple[str, dict[str, str]]] = [
    ("HDFC", {"date": "Date", "description": "Narration", "debit": "Withdrawal Amt.", "credit": "Deposit Amt."}),
    ("ICICI", {"date": "Transaction Date", "description": "Transaction Remarks", "debit": "Withdrawal Amount (INR )", "credit": "Deposit Amount (INR )"}),
    ("SBI", {"date": "Txn Date", "description": "Description", "debit": "Debit", "credit": "Credit"}),
    ("Axis", {"date": "Tran Date", "description": "Particulars", "debit": "DR", "credit": "CR"}),
    ("Kotak", {"date": "Date", "description": "Description", "debit": "Debit", "credit": "Credit"}),
]


@dataclass
class ParsedRow:
    line_no: int
    occurred_at: date
    description: str
    amount: int  # paise, always positive
    direction: str  # debit | credit


def _norm_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def read_csv(text: str) -> tuple[list[str], list[list[str]]]:
    """Parse CSV text, tolerating a BOM and preamble lines before the header."""
    text = text.lstrip("\ufeff")
    sample = text.splitlines()
    # Statements often start with account metadata; find the first line with a date-ish header.
    start = 0
    for i, line in enumerate(sample[:15]):
        low = line.lower()
        if any(k in low for k in DATE_KEYS) and any(k in low for k in DESC_KEYS):
            start = i
            break
    reader = csv.reader(io.StringIO("\n".join(sample[start:])))
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        return [], []
    return [c.strip() for c in rows[0]], rows[1:]


def detect_mapping(headers: list[str]) -> dict[str, str]:
    """Map canonical fields to the actual column names in this file."""
    norm = {_norm_header(h): h for h in headers}

    def pick(keys: tuple[str, ...]) -> str | None:
        for key in keys:
            if key in norm:
                return norm[key]
        for key in keys:  # substring fallback
            for low, original in norm.items():
                if key in low:
                    return original
        return None

    mapping: dict[str, str] = {}
    for field, keys in (("date", DATE_KEYS), ("description", DESC_KEYS)):
        found = pick(keys)
        if found:
            mapping[field] = found

    amount = pick(AMOUNT_KEYS)
    debit, credit = pick(DEBIT_KEYS), pick(CREDIT_KEYS)
    if debit and credit:
        mapping["debit"], mapping["credit"] = debit, credit
    elif amount:
        mapping["amount"] = amount

    balance = pick(BALANCE_KEYS)
    if balance:
        mapping["balance"] = balance
    return mapping


def parse_amount(value: str) -> int | None:
    if value is None:
        return None
    text = str(value).strip().replace("₹", "").replace(",", "").replace(" ", "")
    if not text or text in {"-", "--"}:
        return None
    negative = text.startswith("(") and text.endswith(")") or text.startswith("-")
    text = text.strip("()").lstrip("-").lstrip("+")
    try:
        amount = float(text)
    except ValueError:
        return None
    paise = int(round(amount * 100))
    return -paise if negative else paise


DATE_FORMATS = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y", "%d %b %Y", "%d-%b-%Y", "%d %b %y", "%m/%d/%Y")


def parse_date(value: str) -> date | None:
    text = str(value).strip()
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def dedupe_hash(account_id: str, occurred_at: date, amount: int, description: str) -> str:
    """Same account + date + amount + descriptor prefix ⇒ same transaction."""
    payload = f"{account_id}|{occurred_at.isoformat()}|{amount}|{description.strip().lower()[:40]}"
    return hashlib.sha256(payload.encode()).hexdigest()


def build_candidates(
    text: str,
    account_id: str,
    mapping: dict[str, str] | None = None,
) -> tuple[dict[str, str], list[ParsedRow], list[str]]:
    """Return (mapping used, parsed rows, warnings)."""
    headers, rows = read_csv(text)
    used = mapping or detect_mapping(headers)
    warnings: list[str] = []

    if "date" not in used or "description" not in used:
        raise ValueError("Could not find a date and a description column. Map them manually.")
    if not (("debit" in used and "credit" in used) or "amount" in used):
        raise ValueError("Could not find amount columns. Map debit/credit or a single amount column.")

    index = {h: i for i, h in enumerate(headers)}

    def cell(row: list[str], field: str) -> str:
        name = used.get(field)
        if not name or name not in index:
            return ""
        i = index[name]
        return row[i] if i < len(row) else ""

    parsed: list[ParsedRow] = []
    for n, row in enumerate(rows, start=2):
        occurred = parse_date(cell(row, "date"))
        description = cell(row, "description").strip()
        if not occurred or not description:
            if description or any(c.strip() for c in row):
                warnings.append(f"line {n}: skipped, could not read a date or description")
            continue

        if "amount" in used:
            amount = parse_amount(cell(row, "amount"))
            if amount is None or amount == 0:
                warnings.append(f"line {n}: skipped, amount not readable")
                continue
            direction = "credit" if amount < 0 else "debit"
            amount = abs(amount)
        else:
            debit = parse_amount(cell(row, "debit")) or 0
            credit = parse_amount(cell(row, "credit")) or 0
            if not debit and not credit:
                warnings.append(f"line {n}: skipped, no debit or credit value")
                continue
            direction = "debit" if debit else "credit"
            amount = abs(debit or credit)

        parsed.append(ParsedRow(n, occurred, description, amount, direction))

    return used, parsed, warnings


def mapping_to_json(mapping: dict[str, str]) -> str:
    return json.dumps(mapping, sort_keys=True)
