"""Utility functions for Courtyard Coffee: WhatsApp URL builder, ISO/IEC 18004 240x240 QR PNG generator, and 400x400 thumbnail generator."""
import base64
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


# GF(2^8) lookup tables with primitive polynomial 0x11D for ISO/IEC 18004 Reed-Solomon
_GF_EXP = [0] * 512
_GF_LOG = [0] * 256
_v = 1
for _i in range(255):
    _GF_EXP[_i] = _v
    _GF_LOG[_v] = _i
    _v <<= 1
    if _v & 0x100:
        _v ^= 0x11D
for _i in range(255, 512):
    _GF_EXP[_i] = _GF_EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]


def _rs_generator_poly(degree: int) -> list[int]:
    gen = [1]
    for i in range(degree):
        nxt = [0] * (len(gen) + 1)
        root = _GF_EXP[i]
        for j, coeff in enumerate(gen):
            nxt[j] ^= coeff
            nxt[j + 1] ^= _gf_mul(coeff, root)
        gen = nxt
    return gen


_RS_GEN_10 = _rs_generator_poly(10)


def _rs_encode_10(data_codewords: list[int]) -> list[int]:
    ecc = [0] * 10
    for b in data_codewords:
        factor = b ^ ecc[0]
        ecc = ecc[1:] + [0]
        if factor != 0:
            for j in range(10):
                ecc[j] ^= _gf_mul(_RS_GEN_10[j + 1], factor)
    return ecc


def build_iso_qr_v2l_matrix(text: str) -> list[list[bool]]:
    """
    Builds a genuine ISO/IEC 18004 Version 2-L (25x25) QR matrix in Byte Mode with Mask Pattern 0.
    """
    grid_size = 25
    utf8_bytes = list(str(text or "050-0000000").encode("utf-8"))[:32]

    # 1. Encode 34 data codewords in Byte Mode (0100)
    bits: list[int] = [0, 1, 0, 0]
    for i in range(8):
        bits.append((len(utf8_bytes) >> (7 - i)) & 1)
    for b in utf8_bytes:
        for i in range(8):
            bits.append((b >> (7 - i)) & 1)
    for _ in range(min(4, 34 * 8 - len(bits))):
        bits.append(0)
    while len(bits) % 8 != 0:
        bits.append(0)

    data_codewords: list[int] = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for b in bits[i : i + 8]:
            byte_val = (byte_val << 1) | b
        data_codewords.append(byte_val)

    pad_bytes = [0xEC, 0x11]
    pad_idx = 0
    while len(data_codewords) < 34:
        data_codewords.append(pad_bytes[pad_idx % 2])
        pad_idx += 1

    # 2. Compute 10 Reed-Solomon ECC codewords over GF(2^8)
    ecc_codewords = _rs_encode_10(data_codewords)
    all_codewords = data_codewords + ecc_codewords

    module_bits: list[int] = []
    for cw in all_codewords:
        for i in range(8):
            module_bits.append((cw >> (7 - i)) & 1)
    module_bits.extend([0] * 7)  # 7 remainder bits for Version 2

    # 3. Place function patterns on 25x25 grid
    matrix = [[False] * grid_size for _ in range(grid_size)]
    is_function = [[False] * grid_size for _ in range(grid_size)]

    def place_finder(r0: int, c0: int):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < grid_size and 0 <= c < grid_size:
                    is_function[r][c] = True
                    in_outer = 0 <= dr <= 6 and 0 <= dc <= 6 and (
                        dr in (0, 6) or dc in (0, 6)
                    )
                    in_inner = 2 <= dr <= 4 and 2 <= dc <= 4
                    matrix[r][c] = in_outer or in_inner

    place_finder(0, 0)
    place_finder(0, grid_size - 7)
    place_finder(grid_size - 7, 0)

    # 5x5 Alignment pattern at (16..20, 16..20) centered at (18, 18)
    for dr in range(5):
        for dc in range(5):
            r, c = 16 + dr, 16 + dc
            is_function[r][c] = True
            matrix[r][c] = dr in (0, 4) or dc in (0, 4) or (dr == 2 and dc == 2)

    # Timing patterns along row 6 and col 6
    for i in range(8, grid_size - 8):
        is_function[6][i] = True
        matrix[6][i] = i % 2 == 0
        is_function[i][6] = True
        matrix[i][6] = i % 2 == 0

    # Dark module at (4*V + 9, 8) = (17, 8)
    is_function[17][8] = True
    matrix[17][8] = True

    # Format information for Level L (01) + Mask 0 (000) -> BCH(15,5) masked value 0x77C4
    format_word = 0x77C4
    copy1_coords = [
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
        (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
    ]
    copy2_coords = [
        (24, 8), (23, 8), (22, 8), (21, 8), (20, 8), (19, 8), (18, 8),
        (8, 17), (8, 18), (8, 19), (8, 20), (8, 21), (8, 22), (8, 23), (8, 24),
    ]
    for idx in range(15):
        bit_val = bool((format_word >> (14 - idx)) & 1)
        r1, c1 = copy1_coords[idx]
        is_function[r1][c1] = True
        matrix[r1][c1] = bit_val
        r2, c2 = copy2_coords[idx]
        is_function[r2][c2] = True
        matrix[r2][c2] = bit_val

    # 4. Place data & ECC bits in 2-column upward/downward zigzag and apply Mask 0
    bit_idx = 0
    upward = True
    col = grid_size - 1
    while col > 0:
        if col == 6:
            col -= 1
        row_iter = range(grid_size - 1, -1, -1) if upward else range(grid_size)
        for r in row_iter:
            for dc in (0, 1):
                c = col - dc
                if not is_function[r][c]:
                    data_bit = (
                        bool(module_bits[bit_idx])
                        if bit_idx < len(module_bits)
                        else False
                    )
                    bit_idx += 1
                    mask_bit = (r + c) % 2 == 0
                    matrix[r][c] = data_bit != mask_bit
        upward = not upward
        col -= 2

    return matrix


def generate_qr_data_url(text: str, size: int = 240) -> str:
    grid_size = 25
    matrix = build_iso_qr_v2l_matrix(text)

    dark = b"\x1c\x1c\x1c"
    light = b"\xff\xff\xff"
    scale = 7
    margin = 32  # 32 + 25*7 + 33 = 240
    qr_span = grid_size * scale
    rows: list[bytes] = []
    white_row = light * size
    right_pad = size - margin - qr_span

    for y in range(size):
        if y < margin or y >= margin + qr_span:
            rows.append(white_row)
            continue
        mr = (y - margin) // scale
        row_parts = [light * margin]
        for mc in range(grid_size):
            cell_bytes = (dark if matrix[mr][mc] else light) * scale
            row_parts.append(cell_bytes)
        row_parts.append(light * right_pad)
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
