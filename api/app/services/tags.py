"""Free-form tags on a transaction.

Stored as ",trip,car," in one text column so a tag filter is a portable LIKE on
both SQLite and Postgres, and exposed to clients as a plain list.
"""

import re

MAX_TAGS = 12
MAX_LEN = 32
_STRIP = re.compile(r"[^a-z0-9_-]+")


def normalise(tags: list[str] | None) -> list[str]:
    out: list[str] = []
    for raw in tags or []:
        tag = _STRIP.sub("-", raw.strip().lstrip("#").lower()).strip("-")[:MAX_LEN]
        if tag and tag not in out:
            out.append(tag)
    return out[:MAX_TAGS]


def encode(tags: list[str] | None) -> str:
    clean = normalise(tags)
    return f",{','.join(clean)}," if clean else ""


def decode(stored: str | None) -> list[str]:
    return [t for t in (stored or "").split(",") if t]


def like(tag: str) -> str:
    clean = normalise([tag])
    return f"%,{clean[0]},%" if clean else "%"
