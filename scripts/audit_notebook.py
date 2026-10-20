"""Audit script: extract notebook cells (sources + text outputs), skip images."""
import json

NB = "/home/z/my-project/upload/Credit_Card_Risk.ipynb"
OUT = "/home/z/my-project/scripts/audit_notebook_output.txt"

with open(NB, "r", encoding="utf-8") as f:
    nb = json.load(f)

lines = []
for i, cell in enumerate(nb.get("cells", [])):
    ctype = cell.get("cell_type")
    src = "".join(cell.get("source", []))
    lines.append(f"\n{'='*80}\nCELL {i} [{ctype}] (exec={cell.get('execution_count')})\n{'='*80}")
    lines.append(src)
    for out in cell.get("outputs", []):
        ot = out.get("output_type")
        if ot == "stream":
            lines.append(f"--- OUT(stream:{out.get('name')}):")
            lines.append("".join(out.get("text", [])))
        elif ot in ("execute_result", "display_data"):
            data = out.get("data", {})
            if "text/plain" in data:
                lines.append("--- OUT(plain):")
                lines.append("".join(data["text/plain"]))
            if "image/png" in data:
                lines.append("--- OUT(png): [image omitted]")
        elif ot == "error":
            lines.append(f"--- OUT(error): {out.get('ename')}: {out.get('evalue')}")

text = "\n".join(lines)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Wrote {len(text)} chars to {OUT}")
print(f"Total cells: {len(nb.get('cells', []))}")
