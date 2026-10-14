#!/usr/bin/env python3
"""Converte um export do Notion (Markdown & CSV) em data/notion-data.js.

Uso:
    python3 tools/build_data.py caminho/do/Export.zip
    python3 tools/build_data.py caminho/da/pasta-extraida

Só usa a biblioteca padrão do Python. O resultado é um arquivo JS
(window.NOTION_DATA = {...}) para o site funcionar abrindo o index.html
direto no navegador, sem servidor.
"""

import csv
import json
import re
import shutil
import sys
import tempfile
import zipfile
from datetime import date, datetime
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
OUT_JS = ROOT / "data" / "notion-data.js"
MEDIA_DIR = ROOT / "data" / "media"

PROP_KEYS = [
    "Criado em", "Última edição", "Status", "Tipo", "Projeto", "Área",
    "Atribuição", "Prazo", "Prioridade", "Tempo restante", "Descrição",
]
MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}
MONTHS_FULL = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}
ID_RE = re.compile(r"([0-9a-f]{32})\.(md|csv)$")
SECRET_RE = re.compile(r"(?i)^(\s*(?:[-*]\s+)?(?:\*\*)?(?:senha|password|token|api key)(?:\*\*)?\s*:\s*)(\S.*)$")


def split_list(value):
    return [v.strip() for v in value.split(",") if v.strip()]


def parse_full_date(text):
    """'14 de outubro de 2026 16:47' -> '2026-10-14'"""
    m = re.match(r"(\d{1,2}) de (\w+) de (\d{4})", text or "")
    if not m or m.group(2).lower() not in MONTHS_FULL:
        return None
    return date(int(m.group(3)), MONTHS_FULL[m.group(2).lower()], int(m.group(1))).isoformat()


def parse_short_date(text, year):
    """'out. 13' / 'out. 13 15:00 (BRT)' -> '2026-10-13'"""
    m = re.match(r"(\w{3})\.? (\d{1,2})", text.strip())
    if not m or m.group(1).lower() not in MONTHS:
        return None
    return date(year, MONTHS[m.group(1).lower()], int(m.group(2))).isoformat()


def parse_prazo(raw, year):
    if not raw:
        return None
    parts = [p.strip() for p in raw.split("→")]
    start = parse_short_date(parts[0], year)
    end = parse_short_date(parts[1], year) if len(parts) > 1 else None
    if not start:
        return {"raw": raw}
    return {"raw": raw, "start": start, "end": end}


def read_page(path):
    """Separa título, propriedades e corpo de uma página .md exportada."""
    lines = path.read_text(encoding="utf-8").splitlines()
    title = lines[0].lstrip("#").strip() if lines else path.stem
    props, i = {}, 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    current = None
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^([^:]+): (.*)$", line)
        if m and m.group(1) in PROP_KEYS:
            current = m.group(1)
            props[current] = m.group(2)
        elif current == "Descrição" and line.strip():
            props[current] += "\n" + line
        else:
            break
        i += 1
    body = "\n".join(lines[i:]).strip("\n")
    return title, props, body


def load_export(src):
    src = Path(src)
    if src.is_dir():
        return src, None
    tmp = Path(tempfile.mkdtemp(prefix="notion-export-"))
    with zipfile.ZipFile(src) as zf:
        zf.extractall(tmp)
    # zips aninhados (o Notion às vezes exporta "Part-1.zip" dentro do zip)
    for inner in list(tmp.rglob("*.zip")):
        with zipfile.ZipFile(inner) as zf:
            zf.extractall(inner.parent)
    return tmp, tmp


def find_master_csv(folder):
    """A base principal é o maior *_all.csv que tem a coluna 'Tipo'."""
    best = None
    for f in folder.rglob("*_all.csv"):
        with f.open(encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            rows = list(reader)
        if "Tipo" in (reader.fieldnames or []) and (best is None or len(rows) > len(best[1])):
            best = (f, rows)
    if not best:
        sys.exit("Não encontrei a base principal (*_all.csv com coluna 'Tipo') no export.")
    return best


def norm(text):
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def match_pages(rows, pages):
    """Associa cada linha da base à sua página .md (pelo título e, se precisar, pelas propriedades)."""
    used, result = set(), {}
    fields = ["Tipo", "Status", "Prazo", "Descrição", "Projeto"]

    def score(row, props):
        return sum(norm(row.get(k)) == norm(props.get(k)) for k in fields)

    for idx, row in enumerate(rows):
        cands = [p for p in pages if p["path"] not in used and norm(p["title"]) == norm(row["Nome"])]
        if not cands:
            # títulos com menções relativas (ex.: "Reunião @segunda-feira") não batem com o CSV
            cands = [p for p in pages if p["path"] not in used and p["props"].get("Tipo") == row["Tipo"]
                     and score(row, p["props"]) >= 4]
        if cands:
            best = max(cands, key=lambda p: score(row, p["props"]))
            used.add(best["path"])
            result[idx] = best
    return result


def rewrite_body(body, id_map, media):
    def link(m):
        text, target = m.group(1), m.group(2)
        if re.match(r"^[a-z]+:", target):
            return m.group(0)
        name = unquote(target)
        mid = ID_RE.search(name)
        if mid and mid.group(2) == "md" and mid.group(1) in id_map:
            return f"[{text}](#item/{mid.group(1)})"
        return text

    def image(m):
        alt, target = m.group(1), unquote(m.group(2))
        if re.match(r"^[a-z]+:", target):
            return m.group(0)
        if target in media:
            return f"![{alt}](data/media/{media[target]})"
        return ""

    body = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", image, body)
    body = re.sub(r"(?<!!)\[([^\]]*)\]\(([^)]+)\)", link, body)
    out = []
    for line in body.splitlines():
        m = SECRET_RE.match(line)
        out.append(m.group(1) + "•••••• *(removida do site)*" if m else line)
    return "\n".join(out)


def extract_tools(pages):
    """Links da seção 'Ferramentas' da página inicial (Trello, Meet, Drive...)."""
    link_re = re.compile(r"^\s*[-*]\s+(\S*?)\s*\[\**([^\]*]+)\**\]\((https?://[^)]+)\)")
    for p in pages:
        lines = p["body"].splitlines()
        for k, line in enumerate(lines):
            if "Ferramentas" not in line or line.lstrip().startswith(("-", "*")):
                continue
            tools = []
            for item in lines[k + 1:]:
                if not item.strip():
                    if tools:
                        break
                    continue
                m = link_re.match(item)
                if m:
                    tools.append({"icone": m.group(1), "nome": m.group(2).strip(), "url": m.group(3)})
                elif not item.lstrip().startswith(("-", "*")):
                    break
            if tools:
                return p["title"], tools
    return None, []


def page_id(page):
    m = ID_RE.search(page["path"].name)
    return m.group(1) if m else None


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder, tmp = load_export(sys.argv[1])
    try:
        master_path, rows = find_master_csv(folder)
        pages = []
        for p in folder.rglob("*.md"):
            title, props, body = read_page(p)
            pages.append({"path": p, "title": title, "props": props, "body": body})
        matched = match_pages(rows, pages)

        export_day = None
        for row in rows:
            export_day = max(filter(None, [export_day, parse_full_date(row.get("Última edição"))]), default=None)
        year = int(export_day[:4]) if export_day else datetime.now().year

        # imagens referenciadas nas páginas
        if MEDIA_DIR.exists():
            shutil.rmtree(MEDIA_DIR)
        media = {}
        for img in folder.rglob("*"):
            if img.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
                MEDIA_DIR.mkdir(parents=True, exist_ok=True)
                rel = img.relative_to(folder).as_posix()
                safe = re.sub(r"[^\w.-]+", "-", rel)
                shutil.copy(img, MEDIA_DIR / safe)
                media[rel] = safe
                media[img.name] = safe

        id_map = {}
        for idx in range(len(rows)):
            pid = page_id(matched[idx]) if idx in matched else None
            id_map[pid or f"row{idx}"] = idx

        items = []
        for idx, row in enumerate(rows):
            page = matched.get(idx)
            item_id = (page_id(page) if page else None) or f"row{idx}"
            items.append({
                "id": item_id,
                "titulo": row["Nome"].strip(),
                "tipo": row.get("Tipo", "").strip(),
                "status": row.get("Status", "").strip(),
                "prioridade": row.get("Prioridade", "").strip(),
                "areas": split_list(row.get("Área", "")),
                "pessoas": split_list(row.get("Atribuição", "")),
                "projetos": split_list(row.get("Projeto", "")),
                "prazo": parse_prazo(row.get("Prazo", "").strip(), year),
                "descricao": row.get("Descrição", "").strip(),
                "corpo": rewrite_body(page["body"], id_map, media) if page else "",
            })

        workspace, tools = extract_tools(pages)
        data = {
            "workspace": workspace or "Notion",
            "exportadoEm": export_day,
            "ferramentas": tools,
            "itens": items,
        }
        OUT_JS.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, ensure_ascii=False, indent=1)
        OUT_JS.write_text(
            "// Gerado por tools/build_data.py a partir do export do Notion. Não edite à mão.\n"
            f"window.NOTION_DATA = {payload};\n",
            encoding="utf-8",
        )
        print(f"{len(items)} itens ({len(matched)} com página) -> {OUT_JS.relative_to(ROOT)}")
        if media:
            print(f"{len(set(media.values()))} imagem(ns) -> {MEDIA_DIR.relative_to(ROOT)}")
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
