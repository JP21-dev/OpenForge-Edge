import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from config import settings
from knowledge import collection, embed_documents, reset_collection

CHUNK_CHARS = 1200
BATCH = 32
SUPPORTED = {".md", ".txt", ".pdf", ".json"}


def parse_front_matter(text: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return {}, text
    meta = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, text[match.end():]


def chunk(text: str, limit: int = CHUNK_CHARS) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, current = [], ""
    for para in paragraphs:
        if current and len(current) + len(para) + 2 > limit:
            chunks.append(current)
            current = ""
        while len(para) > limit:
            chunks.append(para[:limit])
            para = para[limit:]
        current = f"{current}\n\n{para}" if current else para
    if current:
        chunks.append(current)
    return chunks


def sections(body: str) -> list[tuple[str, str]]:
    parts = re.split(r"^(#{1,3} .+)$", body, flags=re.MULTILINE)
    out, title = [], ""
    if parts[0].strip():
        out.append(("", parts[0]))
    for i in range(1, len(parts), 2):
        title = parts[i].lstrip("#").strip()
        out.append((title, parts[i + 1]))
    return out


def read_markdown(path: Path) -> tuple[dict, list[dict]]:
    meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
    doc_title = meta.get("title", "")
    pieces = []
    for title, text in sections(body):
        for part in chunk(text):
            heading = " — ".join(t for t in (doc_title, title) if t)
            pieces.append({"text": f"{heading}\n{part}" if heading else part, "section": title, "page": 0})
    return meta, pieces


def read_pdf(path: Path) -> tuple[dict, list[dict]]:
    from pypdf import PdfReader

    pieces = []
    for number, page in enumerate(PdfReader(path).pages, start=1):
        text = page.extract_text() or ""
        for part in chunk(text):
            pieces.append({"text": part, "section": "", "page": number})
    return {}, pieces


def read_json(path: Path) -> tuple[dict, list[dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    meta = {k: str(v) for k, v in data.items() if k != "entries"}
    title = meta.get("title", path.stem)
    pieces = []
    for entry in data.get("entries", []):
        lines = [f"{k}: {v}" for k, v in entry.items() if v not in (None, "")]
        pieces.append({"text": f"{title}\n" + "\n".join(lines), "section": str(entry.get("name", "")), "page": 0})
    return meta, pieces


READERS = {".md": read_markdown, ".txt": read_markdown, ".pdf": read_pdf, ".json": read_json}


def ingest_file(path: Path, root: Path) -> int:
    rel = path.relative_to(root).as_posix()
    meta, pieces = READERS[path.suffix.lower()](path)
    if not pieces:
        print(f"  skip {rel}: no extractable text")
        return 0

    device = meta.get("device") or rel.split("/")[0].lower()
    base = {
        "device": device,
        "source": rel,
        "doc_type": meta.get("type", path.suffix.lstrip(".").lower()),
        "board": meta.get("board", ""),
        "url": meta.get("url", ""),
        "reliability": meta.get("reliability", ""),
    }

    col = collection()
    col.delete(where={"source": rel})
    for start in range(0, len(pieces), BATCH):
        batch = pieces[start:start + BATCH]
        texts = [p["text"] for p in batch]
        col.add(
            ids=[hashlib.sha1(f"{rel}:{start + i}".encode()).hexdigest() for i in range(len(batch))],
            documents=texts,
            embeddings=embed_documents(texts),
            metadatas=[{**base, "section": p["section"], "page": p["page"]} for p in batch],
        )
    print(f"  {rel}: {len(pieces)} chunks ({device})")
    return len(pieces)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load repair manuals into ChromaDB.")
    parser.add_argument("root", nargs="?", default=settings.manuals_dir, help="manuals folder (one subfolder per device)")
    parser.add_argument("--reset", action="store_true", help="drop the collection before ingesting")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"Manuals folder not found: {root}", file=sys.stderr)
        return 1
    if args.reset:
        reset_collection()
        print("Collection reset.")

    files = sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED)
    print(f"Ingesting {len(files)} files from {root} into '{settings.chroma_collection}'")
    total = sum(ingest_file(p, root) for p in files)
    print(f"Done: {total} chunks, collection now holds {collection().count()}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
