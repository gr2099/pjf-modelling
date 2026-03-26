"""
Standalone launcher — used by PyInstaller.
Starts uvicorn on a free port, then opens the browser.
"""
from __future__ import annotations
import os
import sys
import socket
import threading
import webbrowser
import time


def find_free_port(default: int = 8000) -> int:
    for port in range(default, default + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return default


def _open_browser(port: int) -> None:
    time.sleep(1.8)  # give uvicorn a moment to start
    webbrowser.open(f"http://127.0.0.1:{port}")


if __name__ == "__main__":
    # When frozen by PyInstaller the bundle is extracted to sys._MEIPASS
    if getattr(sys, "frozen", False):
        bundle_dir = sys._MEIPASS  # type: ignore[attr-defined]
        os.chdir(bundle_dir)

    port = find_free_port(8000)
    threading.Thread(target=_open_browser, args=(port,), daemon=True).start()

    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )
