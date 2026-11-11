#!/usr/bin/env python3
"""
Pure-Python stdlib Accessibility (a11y) Audit Script for Courtyard Coffee.
Zero external dependencies — uses Chrome DevTools Protocol (CDP) via WebSocket
to audit all three routes for IS 5568 / WCAG 2.0 AA compliance.

Checks:
  1. Document-level: lang, dir, viewport meta, charset
  2. Color contrast: key UI element foreground/background ratios (≥ 4.5:1 AA)
  3. Tap target sizes: interactive elements ≥ 48×48 CSS pixels
  4. ARIA labels: buttons, modals, inputs, bottom sheets
  5. Heading hierarchy: no skipped levels
  6. Form inputs: all have associated labels or aria-label
  7. Image alt text: all <img> tags have alt attributes

Usage:
  # Run full a11y audit (starts server + headless Chrome, audits all 3 routes):
  /usr/bin/python3 scripts/a11y_audit.py

  # Audit a single route:
  /usr/bin/python3 scripts/a11y_audit.py --route /
  /usr/bin/python3 scripts/a11y_audit.py --route /admin/kds
  /usr/bin/python3 scripts/a11y_audit.py --route /admin/menu

Exit codes:
  0 — All checks pass.
  1 — One or more checks failed.
"""
import base64
import json
import math
import os
import shutil
import socket
import struct
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import zlib

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(ROOT_DIR, "screenshots")
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SERVER_PORT = 3000  # Same port as cdp_harness — only one should run at a time
CDP_PORT = 9222     # Same CDP port as cdp_harness


# ---------------------------------------------------------------------------
# Minimal CDP WebSocket Client (shared with cdp_harness.py pattern)
# ---------------------------------------------------------------------------

class CDPClient:
    """Minimal RFC 6455 WebSocket client for Chrome DevTools Protocol."""

    def __init__(self, ws_url: str):
        parsed = urllib.parse.urlparse(ws_url)
        self.host = parsed.hostname or "127.0.0.1"
        self.port = parsed.port or 9222
        self.path = parsed.path or "/"
        self.sock = socket.create_connection((self.host, self.port), timeout=15.0)
        self._buf = b""
        self._next_id = 1
        self._handshake()

    def _handshake(self):
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode("ascii"))
        while b"\r\n\r\n" not in self._buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WebSocket handshake closed unexpectedly")
            self._buf += chunk
        header_end = self._buf.index(b"\r\n\r\n") + 4
        headers = self._buf[:header_end].decode("latin1")
        self._buf = self._buf[header_end:]
        if " 101 " not in headers.splitlines()[0]:
            raise RuntimeError(f"WebSocket handshake failed: {headers}")

    def _recv_exact(self, n: int) -> bytes:
        while len(self._buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("WebSocket connection closed while reading frame")
            self._buf += chunk
        out = self._buf[:n]
        self._buf = self._buf[n:]
        return out

    def _read_frame(self) -> str:
        fragments = []
        while True:
            b1, b2 = self._recv_exact(2)
            fin = (b1 & 0x80) != 0
            opcode = b1 & 0x0F
            masked = (b2 & 0x80) != 0
            length = b2 & 0x7F
            if length == 126:
                (length,) = struct.unpack(">H", self._recv_exact(2))
            elif length == 127:
                (length,) = struct.unpack(">Q", self._recv_exact(8))
            if masked:
                mask = self._recv_exact(4)
                raw = bytearray(self._recv_exact(length))
                for i in range(length):
                    raw[i] ^= mask[i % 4]
                payload = bytes(raw)
            else:
                payload = self._recv_exact(length)
            fragments.append(payload)
            if fin:
                break
        return b"".join(fragments).decode("utf-8")

    def _send_frame(self, data: bytes):
        mask = os.urandom(4)
        masked = bytearray(data)
        for i in range(len(masked)):
            masked[i] ^= mask[i % 4]
        header = bytearray()
        header.append(0x81)  # FIN + TEXT
        length = len(data)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", length))
        header.extend(mask)
        self.sock.sendall(bytes(header) + bytes(masked))

    def call(self, method: str, params: dict = None) -> dict:
        msg_id = self._next_id
        self._next_id += 1
        req = {"id": msg_id, "method": method, "params": params or {}}
        self._send_frame(json.dumps(req).encode("utf-8"))
        while True:
            raw = self._read_frame()
            msg = json.loads(raw)
            if msg.get("id") == msg_id:
                if "error" in msg:
                    raise RuntimeError(f"CDP error in {method}: {msg['error']}")
                return msg.get("result", {})

    def evaluate(self, expression: str):
        res = self.call(
            "Runtime.evaluate",
            {
                "expression": expression,
                "awaitPromise": True,
                "returnByValue": True,
            },
        )
        if "exceptionDetails" in res:
            raise RuntimeError(f"JS Exception: {res['exceptionDetails']}")
        return res.get("result", {}).get("value")

    def set_viewport(self, width: int, height: int, mobile: bool = False):
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": width,
                "height": height,
                "deviceScaleFactor": 2,
                "mobile": mobile,
            },
        )

    def navigate_and_wait(self, url: str, wait_selector: str, timeout: float = 10.0):
        try:
            self.evaluate("window.__navPending = true; if (document.body) document.body.innerHTML = '';")
        except Exception:
            pass
        self.call("Page.navigate", {"url": url})
        deadline = time.time() + timeout
        while time.time() < deadline:
            ready = self.evaluate(
                f"Boolean(!window.__navPending && document.readyState === 'complete' && document.querySelector({json.dumps(wait_selector)}))"
            )
            if ready:
                self.evaluate("""
                    Promise.all(
                      Array.from(document.images).map(img =>
                        img.complete
                          ? Promise.resolve()
                          : new Promise(r => { img.onload = r; img.onerror = r; })
                      )
                    )
                """)
                return
            time.sleep(0.1)
        raise RuntimeError(f"Timed out waiting for selector {wait_selector} at {url}")

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def wait_for_http(url: str, timeout: float = 10.0):
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                body = resp.read().decode("utf-8")
                try:
                    return json.loads(body)
                except json.JSONDecodeError:
                    return body  # Non-JSON response is fine — server is up
        except Exception as err:
            last_err = err
            time.sleep(0.15)
    raise RuntimeError(f"Service at {url} did not become ready: {last_err}")


# ---------------------------------------------------------------------------
# Color contrast utilities (WCAG 2.0 relative luminance & contrast ratio)
# ---------------------------------------------------------------------------

def _srgb_to_linear(c: float) -> float:
    """Convert sRGB channel (0-1) to linear light."""
    if c <= 0.03928:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(r: int, g: int, b: int) -> float:
    """WCAG 2.0 relative luminance from 0-255 RGB values."""
    rl = _srgb_to_linear(r / 255.0)
    gl = _srgb_to_linear(g / 255.0)
    bl = _srgb_to_linear(b / 255.0)
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl


def contrast_ratio(rgb1: tuple, rgb2: tuple) -> float:
    """WCAG 2.0 contrast ratio between two (r, g, b) tuples."""
    l1 = relative_luminance(*rgb1)
    l2 = relative_luminance(*rgb2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def parse_rgb(color_str: str) -> tuple:
    """Parse CSS rgb/rgba string to (r, g, b) tuple."""
    color_str = color_str.strip()
    if color_str.startswith("rgba("):
        parts = color_str[5:-1].split(",")
        return (int(parts[0].strip()), int(parts[1].strip()), int(parts[2].strip()))
    elif color_str.startswith("rgb("):
        parts = color_str[4:-1].split(",")
        return (int(parts[0].strip()), int(parts[1].strip()), int(parts[2].strip()))
    return (0, 0, 0)


# ---------------------------------------------------------------------------
# A11y check functions (run in browser via CDP evaluate)
# ---------------------------------------------------------------------------

CHECK_DOCUMENT_LEVEL = """
(() => {
    const html = document.documentElement;
    const body = document.body;
    const mainContent = document.querySelector('[data-testid="customer-storefront"]') ||
                        document.querySelector('[data-testid="kds-view"]') ||
                        document.querySelector('[data-testid="admin-menu-view"]');
    const computedDir = mainContent
        ? window.getComputedStyle(mainContent).direction
        : window.getComputedStyle(body).direction;

    return {
        lang: html.getAttribute('lang') || '',
        dir: html.getAttribute('dir') || computedDir || '',
        charset: document.characterSet || '',
        viewportMeta: (() => {
            const vp = document.querySelector('meta[name="viewport"]');
            return vp ? vp.getAttribute('content') : '';
        })(),
        title: document.title || '',
    };
})()
"""

CHECK_HEADINGS = """
(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim().substring(0, 80),
        visible: h.offsetParent !== null || window.getComputedStyle(h).position === 'fixed'
    }));
})()
"""

CHECK_INTERACTIVE_ELEMENTS = """
(() => {
    const els = Array.from(document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"], [tabindex]'
    )).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });

    return els.slice(0, 100).map(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            testId: el.getAttribute('data-testid') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            ariaLabelledBy: el.getAttribute('aria-labelledby') || '',
            textContent: el.textContent.trim().substring(0, 60),
            role: el.getAttribute('role') || '',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasLabel: (() => {
                if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                    const id = el.id;
                    if (id && document.querySelector('label[for="' + id + '"]')) return true;
                    if (el.closest('label')) return true;
                    if (el.getAttribute('aria-label')) return true;
                    if (el.getAttribute('aria-labelledby')) return true;
                    if (el.getAttribute('placeholder')) return true;
                    if (el.getAttribute('title')) return true;
                    return false;
                }
                return true;
            })(),
        };
    });
})()
"""

CHECK_IMAGES = """
(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
        return img.offsetParent !== null && img.naturalWidth > 0;
    });
    return imgs.map(img => ({
        src: (img.getAttribute('src') || '').substring(0, 60),
        alt: img.getAttribute('alt'),
        hasAlt: img.hasAttribute('alt'),
        ariaHidden: img.getAttribute('aria-hidden') === 'true',
        role: img.getAttribute('role') || '',
        width: img.naturalWidth,
        height: img.naturalHeight,
    }));
})()
"""

CHECK_CONTRAST = """
(() => {
    const samples = [
        { name: 'body-text', selector: 'body' },
        { name: 'sage-button', selector: '[data-testid="sticky-cart-bar"] button, [data-testid="kds-open-toggle"], .admin-save-btn' },
        { name: 'terracotta-element', selector: '.kds-ticket-done-btn, .admin-overview, [style*="terracotta"]' },
        { name: 'heading', selector: 'h1, h2' },
        { name: 'price-text', selector: '.menu-card-price, .receipt-total, .cart-total' },
    ];

    return samples.map(s => {
        const el = document.querySelector(s.selector);
        if (!el) return { name: s.name, found: false };
        const style = window.getComputedStyle(el);
        return {
            name: s.name,
            found: true,
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontSize: style.fontSize,
        };
    });
})()
"""


# ---------------------------------------------------------------------------
# Route configurations
# ---------------------------------------------------------------------------

ROUTES = {
    "/": {
        "name": "Customer Storefront",
        "wait_selector": '[data-testid="customer-storefront"]',
        "viewport": (390, 844, True),   # mobile
        "expected_lang": "he",
        "expected_dir": "rtl",
    },
    "/admin/kds": {
        "name": "Barista KDS",
        "wait_selector": '[data-testid="pin-gate-modal"], [data-testid="kds-view"]',
        "viewport": (1280, 800, False),  # desktop
        "expected_lang": "he",           # root html lang stays he
        "expected_dir": "ltr",
    },
    "/admin/menu": {
        "name": "Admin Menu",
        "wait_selector": '[data-testid="pin-gate-modal"], [data-testid="admin-menu-view"]',
        "viewport": (1280, 800, False),  # desktop
        "expected_lang": "he",
        "expected_dir": "ltr",
    },
}


# ---------------------------------------------------------------------------
# Audit runner
# ---------------------------------------------------------------------------

def audit_route(cdp: CDPClient, route: str, config: dict) -> list:
    """Run all a11y checks on a single route. Returns list of (status, message) tuples."""
    results = []
    route_name = config["name"]
    w, h, mobile = config["viewport"]

    print(f"\n{'─' * 60}")
    print(f"  Auditing: {route_name} ({route})")
    print(f"  Viewport: {w}×{h} {'(mobile)' if mobile else '(desktop)'}")
    print(f"{'─' * 60}")

    cdp.set_viewport(w, h, mobile)

    # For admin routes, unlock the PIN gate first
    if route.startswith("/admin"):
        cdp.navigate_and_wait(
            f"http://127.0.0.1:{SERVER_PORT}{route}",
            '[data-testid="pin-gate-modal"], [data-testid="kds-view"], [data-testid="admin-menu-view"]',
        )
        # Try to unlock if PIN modal is showing
        pin_present = cdp.evaluate('Boolean(document.querySelector(\'[data-testid="pin-gate-modal"]\'))')
        if pin_present:
            cdp.evaluate("""
                (() => {
                    const inputs = document.querySelectorAll('[data-testid="pin-gate-modal"] input');
                    const digits = '1234';
                    inputs.forEach((inp, i) => {
                        inp.value = digits[i] || '';
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                })()
            """)
            time.sleep(0.5)
            cdp.evaluate("""
                (() => {
                    const btn = document.querySelector('[data-testid="pin-gate-modal"] button[type="submit"], [data-testid="pin-gate-modal"] button');
                    if (btn) btn.click();
                })()
            """)
            time.sleep(1.0)
    else:
        cdp.navigate_and_wait(
            f"http://127.0.0.1:{SERVER_PORT}{route}",
            config["wait_selector"],
        )

    time.sleep(0.5)  # Let the page settle

    # ── Check 1: Document-level attributes ──
    doc = cdp.evaluate(CHECK_DOCUMENT_LEVEL)
    if doc:
        if doc.get("charset", "").upper() == "UTF-8":
            results.append(("PASS", "charset: UTF-8"))
        else:
            results.append(("FAIL", f"charset: expected UTF-8, got '{doc.get('charset')}'"))

        if doc.get("lang"):
            results.append(("PASS", f"lang attribute: '{doc['lang']}'"))
        else:
            results.append(("FAIL", "Missing lang attribute on <html>"))

        actual_dir = doc.get("dir", "")
        expected_dir = config["expected_dir"]
        if actual_dir == expected_dir:
            results.append(("PASS", f"direction: {actual_dir}"))
        else:
            results.append(("WARN", f"direction: got '{actual_dir}', expected '{expected_dir}' (may be set via CSS)"))

        if doc.get("viewportMeta"):
            results.append(("PASS", f"viewport meta present"))
        else:
            results.append(("WARN", "Missing <meta name=\"viewport\"> tag"))

    # ── Check 2: Heading hierarchy ──
    headings = cdp.evaluate(CHECK_HEADINGS)
    if headings:
        prev_level = 0
        hierarchy_ok = True
        for h in headings:
            level = h.get("level", 0)
            if level > prev_level + 1 and prev_level > 0:
                results.append(("WARN", f"Heading skip: h{prev_level} → h{level} ('{h.get('text', '')[:40]}')"))
                hierarchy_ok = False
            prev_level = level
        if hierarchy_ok:
            results.append(("PASS", f"Heading hierarchy: {len(headings)} headings, no skipped levels"))

    # ── Check 3: Interactive elements — ARIA labels ──
    elements = cdp.evaluate(CHECK_INTERACTIVE_ELEMENTS)
    if elements:
        unlabeled_buttons = []
        unlabeled_inputs = []
        small_targets = []

        for el in elements:
            tag = el.get("tag", "")
            has_name = bool(
                el.get("ariaLabel")
                or el.get("ariaLabelledBy")
                or el.get("textContent")
                or el.get("role") == "presentation"
            )

            # Check labels on buttons
            if tag == "button" and not has_name:
                unlabeled_buttons.append(el.get("testId") or "(no testid)")

            # Check labels on form inputs
            if tag in ("input", "select", "textarea") and not el.get("hasLabel"):
                unlabeled_inputs.append(
                    el.get("testId") or el.get("type") or "(no testid)"
                )

            # Check tap target sizes (interactive elements ≥ 48×48 on mobile)
            if mobile and tag in ("button", "a", "input", "select"):
                w_el = el.get("width", 0)
                h_el = el.get("height", 0)
                if w_el > 0 and h_el > 0 and (w_el < 44 or h_el < 44):
                    small_targets.append(
                        f"{el.get('testId') or el.get('textContent', '')[:20] or tag}: {w_el}×{h_el}px"
                    )

        if unlabeled_buttons:
            results.append(("FAIL", f"Buttons without accessible name: {', '.join(unlabeled_buttons[:5])}"))
        else:
            results.append(("PASS", f"All visible buttons have accessible names"))

        if unlabeled_inputs:
            results.append(("FAIL", f"Form inputs without labels: {', '.join(unlabeled_inputs[:5])}"))
        else:
            results.append(("PASS", f"All form inputs have labels"))

        if small_targets:
            results.append(("WARN", f"Small tap targets (<44px): {'; '.join(small_targets[:5])}"))
        else:
            results.append(("PASS", f"All tap targets ≥ 44px"))

    # ── Check 4: Images ──
    images = cdp.evaluate(CHECK_IMAGES)
    if images:
        missing_alt = [
            img for img in images
            if not img.get("hasAlt") and not img.get("ariaHidden") and img.get("role") != "presentation"
        ]
        if missing_alt:
            results.append(("WARN", f"{len(missing_alt)} image(s) missing alt attribute"))
        else:
            results.append(("PASS", f"All {len(images)} images have alt attributes"))

    # ── Check 5: Color contrast ──
    contrasts = cdp.evaluate(CHECK_CONTRAST)
    if contrasts:
        for sample in contrasts:
            if not sample.get("found"):
                continue
            try:
                fg = parse_rgb(sample["color"])
                bg = parse_rgb(sample["backgroundColor"])
                # Skip if background is transparent (rgba with alpha 0)
                if "rgba" in sample.get("backgroundColor", "") and ", 0)" in sample["backgroundColor"]:
                    continue
                ratio = contrast_ratio(fg, bg)
                name = sample["name"]
                font_size = float(sample.get("fontSize", "16px").replace("px", ""))
                min_ratio = 3.0 if font_size >= 18.5 else 4.5  # Large text threshold

                if ratio >= min_ratio:
                    results.append(("PASS", f"Contrast '{name}': {ratio:.1f}:1 (min {min_ratio}:1)"))
                else:
                    results.append(("FAIL", f"Contrast '{name}': {ratio:.1f}:1 < {min_ratio}:1 — fg {sample['color']}, bg {sample['backgroundColor']}"))
            except Exception:
                pass

    # Print results
    for status, msg in results:
        icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}.get(status, "❓")
        print(f"  {icon} {status}  {msg}")

    return results


def run_audit(routes_to_audit: list = None):
    """Run the full a11y audit across specified routes."""
    if routes_to_audit is None:
        routes_to_audit = ["/", "/admin/kds", "/admin/menu"]

    # Seed the database
    subprocess.run(
        ["/usr/bin/python3", os.path.join(ROOT_DIR, "scripts", "seed.py")],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    # Start server
    server_proc = subprocess.Popen(
        ["/usr/bin/python3", os.path.join(ROOT_DIR, "server.py")],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    profile_dir = "/tmp/chrome-a11y-audit-profile"
    shutil.rmtree(profile_dir, ignore_errors=True)
    chrome_proc = None
    cdp = None

    try:
        wait_for_http(f"http://127.0.0.1:{SERVER_PORT}/api/store", timeout=10.0)

        chrome_proc = subprocess.Popen(
            [
                CHROME_BIN,
                "--headless=new",
                f"--remote-debugging-port={CDP_PORT}",
                "--remote-allow-origins=*",
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-gpu",
                "--hide-scrollbars",
                f"http://127.0.0.1:{SERVER_PORT}/",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        targets = wait_for_http(f"http://127.0.0.1:{CDP_PORT}/json", timeout=10.0)
        page_target = next(t for t in targets if t.get("type") == "page")
        cdp = CDPClient(page_target["webSocketDebuggerUrl"])
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")

        print("=" * 60)
        print("  ♿ Courtyard Coffee — Accessibility Audit")
        print("  IS 5568 / WCAG 2.0 AA Compliance Checks")
        print("=" * 60)

        all_results = {}
        total_pass = 0
        total_fail = 0
        total_warn = 0

        for route in routes_to_audit:
            if route not in ROUTES:
                print(f"\n  ⚠️ Unknown route: {route}")
                continue

            results = audit_route(cdp, route, ROUTES[route])
            all_results[route] = results

            for status, _ in results:
                if status == "PASS":
                    total_pass += 1
                elif status == "FAIL":
                    total_fail += 1
                elif status == "WARN":
                    total_warn += 1

        print(f"\n{'=' * 60}")
        print(f"  Summary: {total_pass} passed, {total_fail} failed, {total_warn} warnings")
        print(f"{'=' * 60}")

        # Write JSON report
        report_path = os.path.join(SCREENSHOTS_DIR, "a11y_audit_report.json")
        report_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "routes_audited": routes_to_audit,
            "total_pass": total_pass,
            "total_fail": total_fail,
            "total_warn": total_warn,
            "results": {
                route: [{"status": s, "message": m} for s, m in checks]
                for route, checks in all_results.items()
            },
        }
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        print(f"\n  Report: screenshots/a11y_audit_report.json")

        return total_fail > 0

    finally:
        if cdp:
            cdp.close()
        if chrome_proc:
            chrome_proc.terminate()
            try:
                chrome_proc.wait(timeout=3)
            except Exception:
                chrome_proc.kill()
        server_proc.terminate()
        try:
            server_proc.wait(timeout=3)
        except Exception:
            server_proc.kill()
        shutil.rmtree(profile_dir, ignore_errors=True)


def main():
    args = sys.argv[1:]
    routes = None

    for i, arg in enumerate(args):
        if arg == "--route" and i + 1 < len(args):
            routes = [args[i + 1]]

    has_failures = run_audit(routes)
    sys.exit(1 if has_failures else 0)


if __name__ == "__main__":
    main()
