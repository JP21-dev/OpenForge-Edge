import base64
import io
import re
from functools import lru_cache

from PIL import Image

from config import OPENAI_COMPATIBLE, settings

PROMPT = """You are reading {what} of an electronics schematic for {device}{rev}.
Transcribe what is printed. Do not guess: if text is unreadable, write "unreadable". Never invent part numbers, designators or values.
{hint}
Answer in this exact markdown layout, leaving a section empty if the image has nothing for it:

## Sheet
Sheet title, sheet number and the functional block shown (for example "HDMI output", "5 V regulator").

## Power rails
One line per rail or net carrying power: name, nominal voltage if printed, and what generates or feeds it.

## Components
One line per labelled part: designator, part type, value or part number, and what it connects to.

## Connectors and test points
One line per connector, pin header, test pad or fuse: designator, label, and the nets on it.

## Signals
Other named nets and where they go."""

REGION_NAMES = {
    (2, 0, 0): "the top-left quarter",
    (2, 0, 1): "the top-right quarter",
    (2, 1, 0): "the bottom-left quarter",
    (2, 1, 1): "the bottom-right quarter",
}


def _fit(img: Image.Image, max_side: int) -> Image.Image:
    img = img.convert("RGB")
    scale = max_side / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return img


def tiles(img: Image.Image, grid: int) -> list[tuple[str, Image.Image]]:
    if grid <= 1:
        return [("one page", img)]
    w, h = img.size
    overlap = 0.08
    out = []
    for row in range(grid):
        for col in range(grid):
            left = max(0, int((col / grid - overlap) * w))
            top = max(0, int((row / grid - overlap) * h))
            right = min(w, int(((col + 1) / grid + overlap) * w))
            bottom = min(h, int(((row + 1) / grid + overlap) * h))
            name = REGION_NAMES.get((grid, row, col), f"region {row + 1}-{col + 1}")
            out.append((name, img.crop((left, top, right, bottom))))
    return out


def _png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    _fit(img, settings.vision_max_side).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@lru_cache(maxsize=1)
def _ollama():
    import ollama

    return ollama.Client(host=settings.vision_base_url, timeout=settings.vision_timeout)


@lru_cache(maxsize=1)
def _openai():
    from openai import OpenAI

    return OpenAI(base_url=settings.vision_base_url, api_key=settings.vision_api_key, timeout=settings.vision_timeout)


def _clean(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"^```(?:markdown)?\s*|\s*```$", "", text.strip())
    return text.strip()


def read_region(img: Image.Image, what: str, device: str, rev: str | None, text_layer: str = "") -> str:
    hint = ""
    if text_layer.strip():
        hint = f"The PDF's embedded text for this page (use it to confirm spellings):\n{text_layer[:3000]}\n"
    prompt = PROMPT.format(what=what, device=device, rev=f" board {rev}" if rev else "", hint=hint)
    png = _png(img)

    if settings.vision_provider in OPENAI_COMPATIBLE:
        url = "data:image/png;base64," + base64.b64encode(png).decode()
        res = _openai().chat.completions.create(
            model=settings.vision_model,
            temperature=0,
            max_tokens=settings.vision_max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": url}}],
                }
            ],
        )
        return _clean(res.choices[0].message.content or "")

    res = _ollama().chat(
        model=settings.vision_model,
        messages=[{"role": "user", "content": prompt, "images": [png]}],
        options={
            "temperature": 0,
            "num_ctx": settings.vision_num_ctx,
            "num_predict": settings.vision_max_tokens,
            "repeat_penalty": 1.1,
        },
        keep_alive=settings.llm_keep_alive,
        think=False,
    )
    return _clean(res["message"]["content"] or "")
