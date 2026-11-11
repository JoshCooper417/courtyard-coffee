#!/usr/bin/env python3
"""
Pure-Python stdlib Visual Regression Diff Tool for Courtyard Coffee.
Zero external dependencies — decodes PNG files to raw RGBA pixel arrays
using only the Python 3 standard library and compares them pixel-by-pixel.

Usage:
  # 1. Save current screenshots as baselines (run after a known-good CDP harness run):
  /usr/bin/python3 scripts/visual_diff.py --save-baselines

  # 2. Compare current screenshots against saved baselines:
  /usr/bin/python3 scripts/visual_diff.py

  # 3. Compare with a custom threshold (default 0.5%):
  /usr/bin/python3 scripts/visual_diff.py --threshold 1.0

  # 4. Generate diff images highlighting changed pixels:
  /usr/bin/python3 scripts/visual_diff.py --diff-images

Exit codes:
  0 — All screenshots match baselines within threshold.
  1 — One or more screenshots differ beyond threshold or are missing baselines.
  2 — No baselines exist yet (run --save-baselines first).
"""
import base64
import json
import os
import shutil
import struct
import sys
import zlib

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(ROOT_DIR, "screenshots")
BASELINES_DIR = os.path.join(SCREENSHOTS_DIR, "baselines")
DIFFS_DIR = os.path.join(SCREENSHOTS_DIR, "diffs")

# Screenshots to compare — the CUJ and smoke screenshots produced by cdp_harness.py
SCREENSHOT_NAMES = [
    "cuj01_initial_storefront.png",
    "cuj01_pastry_added.png",
    "cuj02_bottom_sheet_open.png",
    "cuj02_bottom_sheet_selected.png",
    "cuj02_cart_updated.png",
    "cuj03_checkout_sheet_filled.png",
    "cuj03_receipt_with_qr.png",
    "cuj04_kds_unlocked.png",
    "cuj04_pin_modal_error.png",
    "cuj04_pin_modal_locked.png",
    "cuj05_kds_active_ticket.png",
    "cuj05_kds_completed_drawer.png",
    "cuj05_kds_ticket_notified.png",
    "cuj06_customer_closed_and_86.png",
    "cuj06_kds_86_and_closed.png",
    "cuj07_admin_spreadsheet.png",
    "cuj07_customer_new_item.png",
    "cuj07_quick_add_modal.png",
    "m1_smoke_admin_menu.png",
    "m1_smoke_admin_pin_locked.png",
    "m1_smoke_core_utilities.png",
    "m1_smoke_customer_rtl.png",
    "m1_smoke_kds_unlocked.png",
]


# ---------------------------------------------------------------------------
# Pure-stdlib PNG decoder (reads RGBA pixel data from a PNG file)
# ---------------------------------------------------------------------------

def _decode_png(filepath: str) -> tuple:
    """Decode a PNG file to (width, height, pixels: bytes) where pixels is raw RGBA.

    Supports 8-bit RGB and RGBA (color types 2 and 6) — the formats Chrome CDP
    Page.captureScreenshot produces. Returns (width, height, rgba_bytes).
    """
    with open(filepath, "rb") as f:
        data = f.read()

    # Validate PNG signature
    sig = b"\x89PNG\r\n\x1a\n"
    if data[:8] != sig:
        raise ValueError(f"Not a valid PNG file: {filepath}")

    pos = 8
    chunks = {}
    idat_parts = []

    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8].decode("ascii")
        chunk_data = data[pos + 8 : pos + 8 + length]
        pos += 12 + length  # 4 (length) + 4 (type) + length + 4 (CRC)

        if chunk_type == "IHDR":
            chunks["IHDR"] = chunk_data
        elif chunk_type == "IDAT":
            idat_parts.append(chunk_data)
        elif chunk_type == "IEND":
            break

    if "IHDR" not in chunks or not idat_parts:
        raise ValueError(f"Missing IHDR or IDAT in {filepath}")

    ihdr = chunks["IHDR"]
    width = struct.unpack(">I", ihdr[0:4])[0]
    height = struct.unpack(">I", ihdr[4:8])[0]
    bit_depth = ihdr[8]
    color_type = ihdr[9]

    if bit_depth != 8:
        raise ValueError(f"Unsupported bit depth {bit_depth} in {filepath} (only 8-bit supported)")
    if color_type not in (2, 6):
        raise ValueError(f"Unsupported color type {color_type} in {filepath} (only RGB=2 and RGBA=6)")

    channels = 4 if color_type == 6 else 3
    raw = zlib.decompress(b"".join(idat_parts))

    # Reconstruct with PNG filters
    stride = width * channels
    pixels = bytearray(height * width * 4)  # Always output RGBA
    prev_row = bytearray(stride)

    for y in range(height):
        row_start = y * (stride + 1)
        filter_type = raw[row_start]
        row = bytearray(raw[row_start + 1 : row_start + 1 + stride])

        if filter_type == 0:  # None
            pass
        elif filter_type == 1:  # Sub
            for i in range(channels, stride):
                row[i] = (row[i] + row[i - channels]) & 0xFF
        elif filter_type == 2:  # Up
            for i in range(stride):
                row[i] = (row[i] + prev_row[i]) & 0xFF
        elif filter_type == 3:  # Average
            for i in range(stride):
                a = row[i - channels] if i >= channels else 0
                b = prev_row[i]
                row[i] = (row[i] + (a + b) // 2) & 0xFF
        elif filter_type == 4:  # Paeth
            for i in range(stride):
                a = row[i - channels] if i >= channels else 0
                b = prev_row[i]
                c = prev_row[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                if pa <= pb and pa <= pc:
                    pr = a
                elif pb <= pc:
                    pr = b
                else:
                    pr = c
                row[i] = (row[i] + pr) & 0xFF
        else:
            raise ValueError(f"Unknown PNG filter type {filter_type} at row {y}")

        # Copy to RGBA output
        out_offset = y * width * 4
        for x in range(width):
            src = x * channels
            dst = out_offset + x * 4
            pixels[dst] = row[src]          # R
            pixels[dst + 1] = row[src + 1]  # G
            pixels[dst + 2] = row[src + 2]  # B
            pixels[dst + 3] = row[src + 3] if channels == 4 else 255  # A

        prev_row = row

    return width, height, bytes(pixels)


def _encode_png_rgb(width: int, height: int, rgba: bytes) -> bytes:
    """Encode raw RGBA pixels to a minimal valid PNG (RGB, no filter). For diff images."""
    raw_rows = []
    for y in range(height):
        raw_rows.append(b"\x00")  # filter = None
        offset = y * width * 4
        row = bytearray()
        for x in range(width):
            px = offset + x * 4
            row.extend(rgba[px : px + 3])  # RGB only
        raw_rows.append(bytes(row))
    compressed = zlib.compress(b"".join(raw_rows), 9)

    def _chunk(ctype: bytes, data: bytes) -> bytes:
        import binascii
        c = ctype + data
        crc = binascii.crc32(c) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + c + struct.pack(">I", crc)

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr_data)
    png += _chunk(b"IDAT", compressed)
    png += _chunk(b"IEND", b"")
    return png


# ---------------------------------------------------------------------------
# Pixel comparison
# ---------------------------------------------------------------------------

def compare_images(
    baseline_path: str, current_path: str, threshold_pct: float = 0.5
) -> dict:
    """Compare two PNG screenshots pixel-by-pixel.

    Returns a dict with:
      - match: bool (True if mismatch % <= threshold)
      - mismatch_pct: float (percentage of differing pixels)
      - total_pixels: int
      - diff_pixels: int
      - dimensions_match: bool
      - baseline_size: (w, h)
      - current_size: (w, h)
    """
    bw, bh, bpx = _decode_png(baseline_path)
    cw, ch, cpx = _decode_png(current_path)

    result = {
        "baseline_size": (bw, bh),
        "current_size": (cw, ch),
        "dimensions_match": (bw == cw and bh == ch),
    }

    if not result["dimensions_match"]:
        result["match"] = False
        result["mismatch_pct"] = 100.0
        result["total_pixels"] = max(bw * bh, cw * ch)
        result["diff_pixels"] = result["total_pixels"]
        result["diff_rgba"] = None
        return result

    total = bw * bh
    diff_count = 0
    # Build diff image: green = match, red = mismatch
    diff_rgba = bytearray(total * 4)

    for i in range(total):
        offset = i * 4
        br, bg, bb = bpx[offset], bpx[offset + 1], bpx[offset + 2]
        cr, cg, cb = cpx[offset], cpx[offset + 1], cpx[offset + 2]

        # Allow a per-channel tolerance of ±2 for anti-aliasing differences
        if abs(br - cr) > 2 or abs(bg - cg) > 2 or abs(bb - cb) > 2:
            diff_count += 1
            diff_rgba[offset] = 255      # R — highlight red
            diff_rgba[offset + 1] = 0    # G
            diff_rgba[offset + 2] = 0    # B
            diff_rgba[offset + 3] = 255  # A
        else:
            # Dim version of original
            diff_rgba[offset] = cr // 3
            diff_rgba[offset + 1] = cg // 3
            diff_rgba[offset + 2] = cb // 3
            diff_rgba[offset + 3] = 255

    mismatch_pct = (diff_count / total) * 100.0 if total > 0 else 0.0

    result["match"] = mismatch_pct <= threshold_pct
    result["mismatch_pct"] = round(mismatch_pct, 4)
    result["total_pixels"] = total
    result["diff_pixels"] = diff_count
    result["diff_rgba"] = bytes(diff_rgba)
    result["width"] = bw
    result["height"] = bh
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def save_baselines():
    """Copy current screenshots to the baselines directory."""
    os.makedirs(BASELINES_DIR, exist_ok=True)
    saved = 0
    for name in SCREENSHOT_NAMES:
        src = os.path.join(SCREENSHOTS_DIR, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(BASELINES_DIR, name))
            saved += 1
            print(f"  ✓ Saved baseline: {name}")
        else:
            print(f"  ⚠ Skipped (not found): {name}")
    print(f"\n✅ Saved {saved}/{len(SCREENSHOT_NAMES)} baselines to screenshots/baselines/")


def run_comparison(threshold_pct: float = 0.5, generate_diffs: bool = False):
    """Compare current screenshots against baselines."""
    if not os.path.isdir(BASELINES_DIR):
        print("❌ No baselines directory found. Run with --save-baselines first.")
        sys.exit(2)

    if generate_diffs:
        os.makedirs(DIFFS_DIR, exist_ok=True)

    results = []
    passed = 0
    failed = 0
    skipped = 0

    print(f"Visual Regression Test (threshold: {threshold_pct}%)")
    print("=" * 60)

    for name in SCREENSHOT_NAMES:
        current = os.path.join(SCREENSHOTS_DIR, name)
        baseline = os.path.join(BASELINES_DIR, name)

        if not os.path.exists(baseline):
            print(f"  ⚠ SKIP  {name} (no baseline)")
            skipped += 1
            continue
        if not os.path.exists(current):
            print(f"  ⚠ SKIP  {name} (no current screenshot)")
            skipped += 1
            continue

        try:
            result = compare_images(baseline, current, threshold_pct)
        except Exception as e:
            print(f"  ❌ ERROR {name}: {e}")
            failed += 1
            continue

        if result["match"]:
            print(f"  ✅ PASS  {name} ({result['mismatch_pct']:.2f}% diff)")
            passed += 1
        else:
            if result["dimensions_match"]:
                print(
                    f"  ❌ FAIL  {name} ({result['mismatch_pct']:.2f}% diff, "
                    f"{result['diff_pixels']:,} pixels changed)"
                )
            else:
                print(
                    f"  ❌ FAIL  {name} (dimensions changed: "
                    f"{result['baseline_size']} → {result['current_size']})"
                )
            failed += 1

            # Generate diff image if requested
            if generate_diffs and result.get("diff_rgba") and result.get("width"):
                diff_path = os.path.join(DIFFS_DIR, f"diff_{name}")
                png_data = _encode_png_rgb(result["width"], result["height"], result["diff_rgba"])
                with open(diff_path, "wb") as f:
                    f.write(png_data)
                print(f"          Diff image: screenshots/diffs/diff_{name}")

        results.append({"name": name, **{k: v for k, v in result.items() if k != "diff_rgba"}})

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")

    # Write JSON report
    report_path = os.path.join(SCREENSHOTS_DIR, "visual_diff_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "threshold_pct": threshold_pct,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "results": results,
            },
            f,
            indent=2,
        )
    print(f"Report: screenshots/visual_diff_report.json")

    sys.exit(1 if failed > 0 else 0)


def main():
    args = sys.argv[1:]

    if "--save-baselines" in args:
        save_baselines()
        return

    threshold = 0.5
    generate_diffs = "--diff-images" in args

    for i, arg in enumerate(args):
        if arg == "--threshold" and i + 1 < len(args):
            try:
                threshold = float(args[i + 1])
            except ValueError:
                print(f"Invalid threshold: {args[i + 1]}")
                sys.exit(1)

    run_comparison(threshold, generate_diffs)


if __name__ == "__main__":
    main()
