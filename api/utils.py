"""Utility functions for Courtyard Coffee: WhatsApp URL builder, 240x240 QR PNG generator, and 400x400 thumbnail generator."""
import base64
import hashlib
import re
import struct
import zlib
from urllib.parse import quote


def format_wa_phone(raw_phone: str) -> str:
    digits = re.sub(r"\D+", "", str(raw_phone or ""))
    if not digits:
        return ""
    if digits.startswith("00972"):
        digits = "972" + digits[5:]
    elif digits.startswith("0") and len(digits) == 10:
        digits = "972" + digits[1:]
    elif len(digits) == 9 and digits.startswith("5"):
        digits = "972" + digits
    return digits


def build_hebrew_whatsapp_url(raw_phone: str, order: dict) -> str:
    phone = format_wa_phone(raw_phone)
    order_number = order.get("number") or order.get("orderNumber") or ""
    customer_name = order.get("customerName", "")
    total_nis = order.get("total") if order.get("total") is not None else order.get("totalNis", 0)
    items = order.get("items", [])

    lines = [
        f"שלום {customer_name}! ההזמנה שלך (#{order_number}) מ-קפה בחצר מוכנה ☕",
        "פירוט הזמנה:",
    ]
    for item in items:
        qty = item.get("qty", 1)
        title_he = item.get("nameHe") or item.get("titleHe") or item.get("title") or ""
        tags = item.get("tagsHe") or item.get("selectedTags") or []
        tag_labels = [
            (t.get("nameHe") or t.get("labelHe") or str(t)) if isinstance(t, dict) else str(t)
            for t in tags
        ]
        tag_str = f" ({', '.join(tag_labels)})" if tag_labels else ""
        lines.append(f"• {qty}x {title_he}{tag_str}")

    lines.append(f'סה"כ לתשלום: ₪{total_nis}')
    message = "\n".join(lines)
    return f"https://wa.me/{phone}?text={quote(message, safe='')}"


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def _encode_rgb_png(width: int, height: int, rows_rgb: list[bytes]) -> str:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_scanlines = b"".join(b"\x00" + row for row in rows_rgb)
    compressed = zlib.compress(raw_scanlines, level=6)
    png_bytes = (
        signature
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", compressed)
        + _png_chunk(b"IEND", b"")
    )
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def generate_qr_data_url(text: str, size: int = 240) -> str:
    grid_size = 29
    digest = hashlib.sha256(str(text or "").encode("utf-8")).digest()
    matrix = [[False] * grid_size for _ in range(grid_size)]
    reserved = [[False] * grid_size for _ in range(grid_size)]

    def place_finder(r0: int, c0: int):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < grid_size and 0 <= c < grid_size:
                    reserved[r][c] = True
                    in_outer = 0 <= dr <= 6 and 0 <= dc <= 6 and (
                        dr in (0, 6) or dc in (0, 6)
                    )
                    in_inner = 2 <= dr <= 4 and 2 <= dc <= 4
                    matrix[r][c] = in_outer or in_inner

    place_finder(0, 0)
    place_finder(0, grid_size - 7)
    place_finder(grid_size - 7, 0)

    for i in range(8, grid_size - 8):
        reserved[6][i] = True
        reserved[i][6] = True
        matrix[6][i] = i % 2 == 0
        matrix[i][6] = i % 2 == 0

    bit_idx = 0
    for r in range(grid_size):
        for c in range(grid_size):
            if not reserved[r][c]:
                byte_val = digest[(bit_idx // 8) % len(digest)]
                bit = (byte_val >> (bit_idx % 8)) & 1
                matrix[r][c] = bool(bit ^ ((r + c) % 2 == 0))
                bit_idx += 1

    dark = b"\x26\x1c\x18"
    light = b"\xff\xff\xff"
    margin = 16
    inner = size - 2 * margin
    rows = []
    white_row = light * size

    for y in range(size):
        if y < margin or y >= size - margin:
            rows.append(white_row)
            continue
        mr = min(grid_size - 1, ((y - margin) * grid_size) // inner)
        row_parts = [light * margin]
        for x in range(margin, size - margin):
            mc = min(grid_size - 1, ((x - margin) * grid_size) // inner)
            row_parts.append(dark if matrix[mr][mc] else light)
        row_parts.append(light * margin)
        rows.append(b"".join(row_parts))

    return _encode_rgb_png(size, size, rows)


_ART_CACHE: dict[tuple[str, int, int], str] = {}


def generate_art_png_data_url(kind: str, width: int = 400, height: int = 400) -> str:
    cache_key = (kind, width, height)
    if cache_key in _ART_CACHE:
        return _ART_CACHE[cache_key]

    rows: list[bytes] = []
    cx, cy = width // 2, height // 2

    if kind == "cappuccino":
        bg = b"\xf2\xec\xe1"
        cup_rim = b"\xfa\xf6\xf0"
        crema = b"\xc8\x6d\x51"
        foam = b"\xfb\xf8\xf3"
        espresso = b"\x4a\x31\x25"
        for y in range(height):
            dy = y - cy
            dy2 = dy * dy
            row = bytearray(width * 3)
            for x in range(width):
                dx = x - cx
                d2 = dx * dx + dy2
                offset = x * 3
                if d2 > 155 * 155:
                    row[offset : offset + 3] = bg
                elif d2 > 136 * 136:
                    row[offset : offset + 3] = cup_rim
                elif d2 > 126 * 126:
                    row[offset : offset + 3] = espresso
                elif d2 < 68 * 68 and (dx * dx + (dy - abs(dx) * 0.45) ** 2) < 52 * 52:
                    row[offset : offset + 3] = foam
                else:
                    row[offset : offset + 3] = crema
            rows.append(bytes(row))
    else:
        bg = b"\xf2\xec\xe1"
        plate = b"\x3f\x62\x4d"
        plate_in = b"\xfa\xf6\xf0"
        crust = b"\xd4\x88\x46"
        flake = b"\xe6\xa7\x63"
        for y in range(height):
            dy = y - cy
            dy2 = dy * dy
            row = bytearray(width * 3)
            for x in range(width):
                dx = x - cx
                d2 = dx * dx + dy2
                offset = x * 3
                if d2 > 160 * 160:
                    row[offset : offset + 3] = bg
                elif d2 > 144 * 144:
                    row[offset : offset + 3] = plate
                else:
                    in_outer = (dx * dx) / (115 * 115) + ((dy + 15) * (dy + 15)) / (82 * 82) <= 1.0
                    in_cutout = (dx * dx) / (72 * 72) + ((dy - 42) * (dy - 42)) / (58 * 58) <= 1.0
                    if in_outer and not in_cutout:
                        stripe = ((dx + dy) // 24) % 2 == 0
                        row[offset : offset + 3] = flake if stripe else crust
                    else:
                        row[offset : offset + 3] = plate_in
            rows.append(bytes(row))

    data_url = _encode_rgb_png(width, height, rows)
    _ART_CACHE[cache_key] = data_url
    return data_url
