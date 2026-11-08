import base64
import os
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from api.db import create_order, get_store_state, init_db, save_store_state
from api.utils import build_hebrew_whatsapp_url, format_wa_phone, generate_qr_data_url

ROOT_DIR = Path(__file__).resolve().parent.parent


def _decode_png_and_verify_iso_qr(data_url: str) -> dict:
    raw = base64.b64decode(data_url.split(",", 1)[1])
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    width, height, bit_depth, color_type = struct.unpack(">IIBB", raw[16:26])

    # Extract IDAT chunks
    pos = 8
    idat_parts = []
    while pos < len(raw):
        length = struct.unpack(">I", raw[pos : pos + 4])[0]
        ctype = raw[pos + 4 : pos + 8]
        cdata = raw[pos + 8 : pos + 8 + length]
        if ctype == b"IDAT":
            idat_parts.append(cdata)
        elif ctype == b"IEND":
            break
        pos += 12 + length

    decompressed = zlib.decompress(b"".join(idat_parts))
    bpp = 3 if color_type == 2 else 1
    stride = 1 + width * bpp

    def is_dark_pixel(x: int, y: int) -> bool:
        row_start = y * stride
        val = decompressed[row_start + 1 + x * bpp]
        return val < 128

    grid_size = 25
    scale = 7
    margin = 32
    sampled = [
        [
            is_dark_pixel(margin + c * scale + scale // 2, margin + r * scale + scale // 2)
            for c in range(grid_size)
        ]
        for r in range(grid_size)
    ]

    copy1_coords = [
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
        (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
    ]
    copy2_coords = [
        (24, 8), (23, 8), (22, 8), (21, 8), (20, 8), (19, 8), (18, 8),
        (8, 17), (8, 18), (8, 19), (8, 20), (8, 21), (8, 22), (8, 23), (8, 24),
    ]
    fmt1 = 0
    fmt2 = 0
    for r, c in copy1_coords:
        fmt1 = (fmt1 << 1) | (1 if sampled[r][c] else 0)
    for r, c in copy2_coords:
        fmt2 = (fmt2 << 1) | (1 if sampled[r][c] else 0)

    is_func = [[False] * grid_size for _ in range(grid_size)]
    for r0, c0 in ((0, 0), (0, 18), (18, 0)):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < grid_size and 0 <= c < grid_size:
                    is_func[r][c] = True
    for dr in range(5):
        for dc in range(5):
            is_func[16 + dr][16 + dc] = True
    for i in range(8, grid_size - 8):
        is_func[6][i] = True
        is_func[i][6] = True
    is_func[17][8] = True
    for r, c in copy1_coords + copy2_coords:
        is_func[r][c] = True

    unmasked_bits = []
    upward = True
    col = grid_size - 1
    while col > 0:
        if col == 6:
            col -= 1
        row_iter = range(grid_size - 1, -1, -1) if upward else range(grid_size)
        for r in row_iter:
            for dc in (0, 1):
                c = col - dc
                if not is_func[r][c]:
                    mask_bit = (r + c) % 2 == 0
                    bit = 1 if (sampled[r][c] != mask_bit) else 0
                    unmasked_bits.append(bit)
        upward = not upward
        col -= 2

    codewords = []
    for i in range(0, 44 * 8, 8):
        byte_val = 0
        for b in unmasked_bits[i : i + 8]:
            byte_val = (byte_val << 1) | b
        codewords.append(byte_val)

    # Verify GF(2^8) Reed-Solomon syndromes for 10 ECC codewords
    gf_exp = [0] * 512
    gf_log = [0] * 256
    v = 1
    for i in range(255):
        gf_exp[i] = v
        gf_log[v] = i
        v <<= 1
        if v & 0x100:
            v ^= 0x11D
    for i in range(255, 512):
        gf_exp[i] = gf_exp[i - 255]

    def gf_mul(a: int, b: int) -> int:
        if a == 0 or b == 0:
            return 0
        return gf_exp[gf_log[a] + gf_log[b]]

    syndromes = []
    for i in range(10):
        syn = 0
        root = gf_exp[i]
        for cw in codewords:
            syn = gf_mul(syn, root) ^ cw
        syndromes.append(syn)

    # Decode Byte Mode payload
    mode = (
        (unmasked_bits[0] << 3)
        | (unmasked_bits[1] << 2)
        | (unmasked_bits[2] << 1)
        | unmasked_bits[3]
    )
    byte_len = 0
    for b in unmasked_bits[4:12]:
        byte_len = (byte_len << 1) | b
    payload_bytes = bytearray()
    for i in range(byte_len):
        bval = 0
        for b in unmasked_bits[12 + i * 8 : 12 + (i + 1) * 8]:
            bval = (bval << 1) | b
        payload_bytes.append(bval)

    return {
        "width": width,
        "height": height,
        "format1": fmt1,
        "format2": fmt2,
        "syndromes": syndromes,
        "mode": mode,
        "decoded_text": payload_bytes.decode("utf-8"),
    }


class TestMilestone1Utils(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_data.db")
        init_db(db_path=self.db_path, reset=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_sqlite_seed_state_invariants(self):
        store = get_store_state(db_path=self.db_path)
        self.assertIs(store.get("isOpen"), True)
        self.assertEqual(store.get("closedNoteHe"), "סגור כעת, נשוב בקרוב")
        self.assertEqual(store.get("bitPhone"), "050-0000000")
        self.assertEqual(store.get("adminPin"), "1234")
        self.assertEqual(store.get("nextOrderNumber"), 101)

        photos = store.get("photoAlbum", [])
        self.assertEqual(len(photos), 2)
        photo_ids = {p.get("id") for p in photos}
        self.assertEqual(photo_ids, {"photo-cappuccino", "photo-croissant"})
        for photo in photos:
            data_url = photo.get("url") or photo.get("dataUrl", "")
            self.assertTrue(data_url.startswith("data:image/png;base64,"))
            raw = base64.b64decode(data_url.split(",", 1)[1])
            self.assertEqual(raw[:8], b"\x89PNG\r\n\x1a\n")
            width, height = struct.unpack(">II", raw[16:24])
            self.assertEqual((width, height), (400, 400))

        tags = store.get("globalTags", [])
        self.assertEqual(len(tags), 3)
        tags_by_id = {t["id"]: t for t in tags}
        self.assertTrue(tags_by_id["tag-oat"]["inStock"])
        self.assertEqual(tags_by_id["tag-oat"]["price"], 2)
        self.assertTrue(tags_by_id["tag-decaf"]["inStock"])
        self.assertEqual(tags_by_id["tag-decaf"]["price"], 0)
        self.assertFalse(tags_by_id["tag-syrup"]["inStock"])
        self.assertEqual(tags_by_id["tag-syrup"]["price"], 3)

        items = store.get("menuItems", [])
        self.assertEqual(len(items), 2)
        items_by_id = {i["id"]: i for i in items}
        self.assertEqual(items_by_id["item-cappuccino"]["price"], 14)
        self.assertEqual(items_by_id["item-croissant"]["price"], 12)

    def test_monotonic_next_order_number_protection(self):
        order = create_order(
            {
                "customerName": "דני",
                "customerPhone": "054-9876543",
                "items": [
                    {
                        "itemId": "item-cappuccino",
                        "qty": 1,
                        "selectedTagIds": ["tag-oat"],
                    }
                ],
            },
            db_path=self.db_path,
        )
        self.assertEqual(order.get("number"), 101)
        self.assertEqual(order.get("orderNumber"), 101)
        self.assertEqual(order.get("total"), 16)
        self.assertEqual(order.get("totalNis"), 16)

        after_order_store = get_store_state(db_path=self.db_path)
        self.assertEqual(after_order_store.get("nextOrderNumber"), 102)

        # Simulate stale admin client saving nextOrderNumber=101
        stale_payload = dict(after_order_store)
        stale_payload["nextOrderNumber"] = 101
        stale_payload["closedNoteHe"] = "נחזור ב-14:00"
        updated_store = save_store_state(stale_payload, db_path=self.db_path)
        self.assertEqual(updated_store.get("nextOrderNumber"), 102)
        self.assertEqual(updated_store.get("closedNoteHe"), "נחזור ב-14:00")

    def test_whatsapp_phone_and_hebrew_url_builder(self):
        self.assertEqual(format_wa_phone("054-9876543"), "972549876543")
        self.assertEqual(format_wa_phone("+972 50-000-0000"), "972500000000")

        url = build_hebrew_whatsapp_url(
            "054-9876543",
            {
                "number": 101,
                "customerName": "נועה",
                "total": 16,
                "items": [
                    {
                        "nameHe": "קפוצ׳ינו",
                        "qty": 1,
                        "tagsHe": ["חלב שיבולת שועל"],
                    }
                ],
            },
        )
        self.assertTrue(url.startswith("https://wa.me/972549876543?text="))
        parsed = urlparse(url)
        text = parse_qs(parsed.query).get("text", [""])[0]
        self.assertIn("101", text)
        self.assertIn("נועה", text)
        self.assertIn("קפוצ׳ינו", text)
        self.assertIn("חלב שיבולת שועל", text)
        self.assertIn("16", text)

    def test_qr_data_url_is_valid_240x240_png(self):
        data_url = generate_qr_data_url("050-0000000")
        self.assertTrue(data_url.startswith("data:image/png;base64,"))
        decoded = _decode_png_and_verify_iso_qr(data_url)
        self.assertEqual((decoded["width"], decoded["height"]), (240, 240))
        self.assertEqual(decoded["format1"], 0x77C4)
        self.assertEqual(decoded["format2"], 0x77C4)
        self.assertEqual(decoded["syndromes"], [0] * 10)
        self.assertEqual(decoded["mode"], 0b0100)
        self.assertEqual(decoded["decoded_text"], "050-0000000")

    def test_js_utility_modules_contract(self):
        wa_js = (ROOT_DIR / "src" / "utils" / "wa.js").read_text(encoding="utf-8")
        self.assertIn("https://wa.me/", wa_js)
        self.assertIn("encodeURIComponent", wa_js)
        self.assertIn("972", wa_js)

        qr_js = (ROOT_DIR / "src" / "utils" / "qr.js").read_text(encoding="utf-8")
        self.assertIn("data:image/png;base64,", qr_js)
        self.assertIn("IHDR", qr_js)
        self.assertIn("0x77c4", qr_js)
        self.assertIn("rsEncode10", qr_js)


if __name__ == "__main__":
    unittest.main()
