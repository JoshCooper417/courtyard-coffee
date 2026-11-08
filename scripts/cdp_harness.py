#!/usr/bin/env python3
"""
Pure-Python stdlib Chrome DevTools Protocol (CDP) Live Browser Smoke & Red -> Green Harness
for Courtyard Coffee. Zero Node/npm dependencies.
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import time
import urllib.parse
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(ROOT_DIR, "screenshots")
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SERVER_PORT = 3000
CDP_PORT = 9222


class CDPClient:
    """Minimal RFC 6455 WebSocket client for Chrome DevTools Protocol using Python stdlib."""

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
            mask_key = self._recv_exact(4) if masked else None
            payload = self._recv_exact(length)
            if masked and mask_key:
                payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
            if opcode == 0x8:
                raise RuntimeError("WebSocket closed by remote")
            if opcode == 0x9:  # Ping -> send Pong
                self._send_frame(payload, opcode=0xA)
                continue
            if opcode in (0x1, 0x0):
                fragments.append(payload)
                if fin:
                    return b"".join(fragments).decode("utf-8")

    def _send_frame(self, payload: bytes, opcode: int = 0x1):
        mask_key = os.urandom(4)
        header = bytearray([0x80 | opcode])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", length))
        header.extend(mask_key)
        masked_payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked_payload)

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
        self.call("Page.navigate", {"url": url})
        deadline = time.time() + timeout
        while time.time() < deadline:
            ready = self.evaluate(
                f"Boolean(document.readyState === 'complete' && document.querySelector({json.dumps(wait_selector)}))"
            )
            if ready:
                self.evaluate(
                    """
                    Promise.all(
                      Array.from(document.images).map(img =>
                        img.complete
                          ? Promise.resolve()
                          : new Promise(r => { img.onload = r; img.onerror = r; })
                      )
                    )
                    """
                )
                return
            time.sleep(0.1)
        raise RuntimeError(f"Timed out waiting for selector {wait_selector} at {url}")

    def screenshot(self, out_path: str):
        res = self.call("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(res["data"])
        with open(out_path, "wb") as f:
            f.write(data)
        return len(data)

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
                return json.loads(resp.read().decode("utf-8"))
        except Exception as err:
            last_err = err
            time.sleep(0.15)
    raise RuntimeError(f"Service at {url} did not become ready: {last_err}")


def run_m1_smoke():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    subprocess.run(["/usr/bin/python3", os.path.join(ROOT_DIR, "scripts", "seed.py")], check=True)

    server_proc = subprocess.Popen(
        ["/usr/bin/python3", os.path.join(ROOT_DIR, "server.py")],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    profile_dir = "/tmp/chrome-cuj-profile-m1"
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

        report = {}

        # 1. Customer Storefront ("/") at 390x844 mobile viewport
        cdp.set_viewport(390, 844, mobile=True)
        cdp.navigate_and_wait(f"http://127.0.0.1:{SERVER_PORT}/", '[data-testid="customer-storefront"]')
        customer_telemetry = cdp.evaluate(
            """
            (() => {
              const htmlDir = document.documentElement.getAttribute('dir');
              const mainDir = document.querySelector('[data-testid="customer-storefront"]')?.getAttribute('dir');
              const title = document.querySelector('.store-brand-title')?.textContent?.trim();
              const badge = document.querySelector('[data-testid="store-status-badge"]')?.textContent?.trim();
              const cards = Array.from(document.querySelectorAll('.menu-card')).map(c => ({
                id: c.getAttribute('data-item-id'),
                title: c.querySelector('.menu-card-title')?.textContent?.trim(),
                price: c.querySelector('.price-tag')?.textContent?.trim(),
                imgNaturalWidth: c.querySelector('img')?.naturalWidth || 0,
                imgNaturalHeight: c.querySelector('img')?.naturalHeight || 0,
                imgComplete: Boolean(c.querySelector('img')?.complete)
              }));
              return { htmlDir, mainDir, title, badge, cards };
            })()
            """
        )
        p1 = os.path.join(SCREENSHOTS_DIR, "m1_smoke_customer_rtl.png")
        cdp.screenshot(p1)
        report["customer_rtl"] = {"telemetry": customer_telemetry, "screenshot": p1}

        # 2. Admin KDS ("/admin/kds") at 1280x800 — RED (Blocked) -> GREEN (Unlocked) Proof
        cdp.set_viewport(1280, 800, mobile=False)
        cdp.evaluate("localStorage.clear()")
        cdp.navigate_and_wait(f"http://127.0.0.1:{SERVER_PORT}/admin/kds", '[data-testid="pin-gate-modal"]')

        red_telemetry = cdp.evaluate(
            """
            (() => {
              const input = document.querySelector('[data-testid="pin-input"]');
              const form = document.querySelector('#pin-gate-form');
              input.value = '9999';
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              return {
                htmlDir: document.documentElement.getAttribute('dir'),
                pinModalPresent: Boolean(document.querySelector('[data-testid="pin-gate-modal"]')),
                kdsViewPresent: Boolean(document.querySelector('[data-testid="kds-view"]')),
                errorText: document.querySelector('[data-testid="pin-error"]')?.textContent?.trim() || null,
                storedPin: localStorage.getItem('adminPin')
              };
            })()
            """
        )
        p2 = os.path.join(SCREENSHOTS_DIR, "m1_smoke_admin_pin_locked.png")
        cdp.screenshot(p2)
        report["admin_pin_locked_red"] = {"telemetry": red_telemetry, "screenshot": p2}

        green_telemetry = cdp.evaluate(
            """
            (async () => {
              const input = document.querySelector('[data-testid="pin-input"]');
              const form = document.querySelector('#pin-gate-form');
              input.value = '1234';
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              for (let i = 0; i < 50; i++) {
                if (document.querySelector('[data-testid="kds-view"]')) break;
                await new Promise(r => setTimeout(r, 50));
              }
              return {
                htmlDir: document.documentElement.getAttribute('dir'),
                pinModalPresent: Boolean(document.querySelector('[data-testid="pin-gate-modal"]')),
                kdsViewPresent: Boolean(document.querySelector('[data-testid="kds-view"]')),
                heading: document.querySelector('h1')?.textContent?.trim(),
                queueText: document.querySelector('[data-testid="kds-orders-grid"]')?.textContent?.trim(),
                storedPin: localStorage.getItem('adminPin')
              };
            })()
            """
        )
        p3 = os.path.join(SCREENSHOTS_DIR, "m1_smoke_kds_unlocked.png")
        cdp.screenshot(p3)
        report["admin_kds_unlocked_green"] = {"telemetry": green_telemetry, "screenshot": p3}

        # 3. Admin Menu ("/admin/menu") at 1280x800 unlocked in English LTR
        cdp.navigate_and_wait(f"http://127.0.0.1:{SERVER_PORT}/admin/menu", '[data-testid="admin-menu-view"]')
        admin_menu_telemetry = cdp.evaluate(
            """
            (() => {
              return {
                htmlDir: document.documentElement.getAttribute('dir'),
                mainDir: document.querySelector('[data-testid="admin-menu-view"]')?.getAttribute('dir'),
                heading: document.querySelector('h1')?.textContent?.trim(),
                overviewText: document.querySelector('section p')?.textContent?.trim(),
                storedPin: localStorage.getItem('adminPin')
              };
            })()
            """
        )
        p4 = os.path.join(SCREENSHOTS_DIR, "m1_smoke_admin_menu.png")
        cdp.screenshot(p4)
        report["admin_menu_ltr"] = {"telemetry": admin_menu_telemetry, "screenshot": p4}

        # 4. Real Chrome Image decode check for generateQrDataUrl("050-0000000")
        qr_telemetry = cdp.evaluate(
            """
            (async () => {
              const mod = await import('/src/utils/qr.js');
              const dataUrl = mod.generateQrDataUrl('050-0000000');
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
              });
              return {
                prefix: dataUrl.slice(0, 32),
                complete: img.complete,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
              };
            })()
            """
        )
        report["qr_generator_chrome"] = qr_telemetry

        print(json.dumps(report, ensure_ascii=False, indent=2))
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


if __name__ == "__main__":
    run_m1_smoke()
