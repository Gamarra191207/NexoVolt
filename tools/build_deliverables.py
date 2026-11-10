from __future__ import annotations

import html
import re
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "pdf"
ACCENT = colors.HexColor("#168B8A")
ACCENT_DARK = colors.HexColor("#12383D")
PALE = colors.HexColor("#EAF6F5")
LIGHT = colors.HexColor("#F4F7F7")
GRID = colors.HexColor("#D9E0E0")
MUTED = colors.HexColor("#4C5B5D")


def register_fonts() -> tuple[str, str, str]:
    candidates = [
        (
            Path(r"C:\Windows\Fonts\arial.ttf"),
            Path(r"C:\Windows\Fonts\arialbd.ttf"),
            Path(r"C:\Windows\Fonts\ariali.ttf"),
        ),
        (
            Path(r"C:\Windows\Fonts\calibri.ttf"),
            Path(r"C:\Windows\Fonts\calibrib.ttf"),
            Path(r"C:\Windows\Fonts\calibrii.ttf"),
        ),
    ]
    for regular, bold, italic in candidates:
        if regular.exists() and bold.exists() and italic.exists():
            pdfmetrics.registerFont(TTFont("NexoRegular", str(regular)))
            pdfmetrics.registerFont(TTFont("NexoBold", str(bold)))
            pdfmetrics.registerFont(TTFont("NexoItalic", str(italic)))
            pdfmetrics.registerFontFamily(
                "NexoRegular",
                normal="NexoRegular",
                bold="NexoBold",
                italic="NexoItalic",
                boldItalic="NexoBold",
            )
            return "NexoRegular", "NexoBold", "NexoItalic"
    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


REGULAR, BOLD, ITALIC = register_fonts()


def inline_markup(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"`([^`]+)`", rf'<font name="Courier" color="#174C50">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", rf'<font name="{BOLD}">\1</font>', escaped)
    return escaped


def make_styles():
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=10.4,
            leading=15.3,
            textColor=colors.HexColor("#18272A"),
            spaceAfter=8,
            alignment=TA_LEFT,
        ),
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=BOLD,
            fontSize=27,
            leading=31,
            textColor=colors.black,
            alignment=TA_LEFT,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=12.5,
            leading=18,
            textColor=MUTED,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName=BOLD,
            fontSize=16,
            leading=20,
            textColor=colors.black,
            spaceBefore=15,
            spaceAfter=7,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontName=BOLD,
            fontSize=12.2,
            leading=16,
            textColor=colors.black,
            spaceBefore=11,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=10.2,
            leading=14.5,
            leftIndent=16,
            firstLineIndent=-10,
            spaceAfter=4,
            textColor=colors.HexColor("#18272A"),
        ),
        "number": ParagraphStyle(
            "Number",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=10.2,
            leading=14.5,
            leftIndent=20,
            firstLineIndent=-16,
            spaceAfter=4,
            textColor=colors.HexColor("#18272A"),
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=8.5,
            leading=11,
            textColor=MUTED,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName=BOLD,
            fontSize=8.6,
            leading=11,
            textColor=colors.white,
        ),
        "table_body": ParagraphStyle(
            "TableBody",
            parent=base["BodyText"],
            fontName=REGULAR,
            fontSize=8.5,
            leading=11.2,
            textColor=colors.HexColor("#18272A"),
        ),
    }


STYLES = make_styles()


@dataclass(frozen=True)
class DocumentSpec:
    source: Path
    output: Path
    title: str
    subtitle: str
    kind: str


class NexoDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, title: str, kind: str):
        super().__init__(
            filename,
            pagesize=letter,
            leftMargin=0.78 * inch,
            rightMargin=0.72 * inch,
            topMargin=0.72 * inch,
            bottomMargin=0.7 * inch,
            title=title,
            author="Proyecto NexoVolt",
            subject=kind,
        )
        self.document_title = title
        self.document_kind = kind
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates(PageTemplate(id="body", frames=[frame], onPage=self._draw_page))

    def _draw_page(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setFont(REGULAR, 8)
            canvas.setFillColor(MUTED)
            canvas.drawString(self.leftMargin, letter[1] - 0.38 * inch, "NexoVolt")
            canvas.drawRightString(letter[0] - self.rightMargin, letter[1] - 0.38 * inch, self.document_kind)
            canvas.setStrokeColor(GRID)
            canvas.setLineWidth(0.5)
            canvas.line(self.leftMargin, letter[1] - 0.47 * inch, letter[0] - self.rightMargin, letter[1] - 0.47 * inch)
        canvas.setFont(REGULAR, 8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(letter[0] / 2, 0.38 * inch, f"{doc.page}")
        canvas.restoreState()


def cover(spec: DocumentSpec):
    return [
        Spacer(1, 0.42 * inch),
        Paragraph("NEXOVOLT", ParagraphStyle("Brand", parent=STYLES["small"], fontName=BOLD, fontSize=10, textColor=ACCENT, tracking=1.4, spaceAfter=30)),
        Paragraph(spec.title, STYLES["title"]),
        Paragraph(spec.subtitle, STYLES["subtitle"]),
        Spacer(1, 0.1 * inch),
        HRFlowable(width="28%", thickness=3, color=ACCENT, spaceBefore=4, spaceAfter=24, hAlign="LEFT"),
        Paragraph("Aplicación educativa de electromagnetismo", ParagraphStyle("CoverMeta", parent=STYLES["body"], fontName=BOLD, fontSize=11, textColor=ACCENT_DARK, spaceAfter=5)),
        Paragraph("React, TypeScript, Vite, Tauri y Rust", STYLES["body"]),
        Spacer(1, 2.5 * inch),
        Paragraph("Versión de entrega 10 de noviembre de 2026", STYLES["small"]),
        Paragraph("Repositorio NexoVolt", STYLES["small"]),
        PageBreak(),
    ]


def parse_table(lines: list[str], start: int):
    rows: list[list[str]] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
        rows.append(cells)
        index += 1
    if len(rows) >= 2 and all(re.fullmatch(r"[-: ]+", cell or "-") for cell in rows[1]):
        rows.pop(1)
    return rows, index


def table_flowable(rows: list[list[str]]):
    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = STYLES["table_header"] if row_index == 0 else STYLES["table_body"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    available = 7.0 * inch
    if normalized[0][0] == "Capa" and column_count == 3:
        widths = [1.15 * inch, 1.75 * inch, 4.1 * inch]
    else:
        longest = [max(4, max(len(row[col]) for row in normalized)) for col in range(column_count)]
        total = sum(longest)
        widths = [available * value / total for value in longest]
        minimum = 0.9 * inch
        widths = [max(minimum, width) for width in widths]
        scale = available / sum(widths)
        widths = [width * scale for width in widths]

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.55, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for row_index in range(1, len(data)):
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.white if row_index % 2 else LIGHT))
    table.setStyle(TableStyle(commands))
    return table


def markdown_story(spec: DocumentSpec):
    lines = spec.source.read_text(encoding="utf-8").splitlines()
    story = cover(spec)
    index = 0
    paragraph_buffer: list[str] = []

    def flush_paragraph():
        if paragraph_buffer:
            text = " ".join(item.strip() for item in paragraph_buffer)
            story.append(Paragraph(inline_markup(text), STYLES["body"]))
            paragraph_buffer.clear()

    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if not stripped:
            flush_paragraph()
            index += 1
            continue
        if stripped.startswith("# "):
            index += 1
            continue
        if stripped.startswith("## "):
            flush_paragraph()
            title = stripped[3:].strip()
            story.append(KeepTogether([
                Spacer(1, 3),
                Paragraph(inline_markup(title), STYLES["h2"]),
                HRFlowable(width="100%", thickness=1, color=GRID, spaceBefore=0, spaceAfter=8),
            ]))
            index += 1
            continue
        if stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[4:].strip()), STYLES["h3"]))
            index += 1
            continue
        if stripped.startswith("|"):
            flush_paragraph()
            rows, index = parse_table(lines, index)
            story.append(Spacer(1, 5))
            story.append(table_flowable(rows))
            story.append(Spacer(1, 9))
            continue
        bullet = re.match(r"^-\s+(.+)$", stripped)
        number = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        nested = re.match(r"^\s{2,}-\s+(.+)$", raw)
        if nested:
            flush_paragraph()
            story.append(Paragraph(f"- {inline_markup(nested.group(1))}", ParagraphStyle("NestedBullet", parent=STYLES["bullet"], leftIndent=32)))
        elif bullet:
            flush_paragraph()
            story.append(Paragraph(f"• {inline_markup(bullet.group(1))}", STYLES["bullet"]))
        elif number:
            flush_paragraph()
            story.append(Paragraph(f"{number.group(1)}. {inline_markup(number.group(2))}", STYLES["number"]))
        else:
            paragraph_buffer.append(stripped)
        index += 1
    flush_paragraph()
    return story


def build(spec: DocumentSpec):
    spec.output.parent.mkdir(parents=True, exist_ok=True)
    document = NexoDocTemplate(str(spec.output), spec.title, spec.kind)
    document.build(markdown_story(spec))


def main():
    specs = [
        DocumentSpec(
            source=ROOT / "docs" / "manual-usuario.md",
            output=OUTPUT_DIR / "manual-usuario-nexovolt.pdf",
            title="Manual de usuario de NexoVolt",
            subtitle="Guía para iniciar la aplicación, usar las cuatro estaciones y comprender sus resultados",
            kind="Manual de usuario",
        ),
        DocumentSpec(
            source=ROOT / "docs" / "informe-tecnico.md",
            output=OUTPUT_DIR / "informe-tecnico-nexovolt.pdf",
            title="Informe técnico de NexoVolt",
            subtitle="Fundamentos físicos, arquitectura, algoritmos, pruebas y validación",
            kind="Informe técnico",
        ),
    ]
    for spec in specs:
        build(spec)
        print(spec.output)


if __name__ == "__main__":
    main()
