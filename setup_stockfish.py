"""Download the latest Stockfish build and place stockfish.exe in ./stockfish/.

Usage:  python setup_stockfish.py
Falls back to printing manual instructions if the download fails.
"""
import io
import json
import os
import platform
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEST_DIR = os.path.join(HERE, "stockfish")
RELEASES_API = "https://api.github.com/repos/official-stockfish/Stockfish/releases/latest"
# Most → least optimised; we pick the first your CPU is likely to support.
WINDOWS_PREFS = ["x86-64-avx2", "x86-64-sse41-popcnt", "x86-64"]


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "chess-analysis-setup"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def _pick_windows_asset(assets: list) -> str | None:
    names = {a["name"]: a["browser_download_url"] for a in assets if a["name"].endswith(".zip")}
    win = {n: u for n, u in names.items() if "windows" in n.lower()}
    for pref in WINDOWS_PREFS:
        for name, url in win.items():
            if pref in name.lower():
                return url
    return next(iter(win.values()), None)


def main() -> int:
    if platform.system() != "Windows":
        print("This helper targets Windows. On macOS/Linux install Stockfish via your")
        print("package manager (brew install stockfish / apt install stockfish) and set")
        print("the STOCKFISH_PATH environment variable.")
        return 1

    os.makedirs(DEST_DIR, exist_ok=True)
    target = os.path.join(DEST_DIR, "stockfish.exe")
    if os.path.isfile(target):
        print(f"Stockfish already present at {target}")
        return 0

    try:
        print("Querying latest Stockfish release…")
        release = _get_json(RELEASES_API)
        url = _pick_windows_asset(release.get("assets", []))
        if not url:
            raise RuntimeError("No suitable Windows asset found in the latest release.")

        print(f"Downloading: {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "chess-analysis-setup"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()

        print("Extracting…")
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            exe = next((n for n in z.namelist() if n.lower().endswith(".exe")), None)
            if not exe:
                raise RuntimeError("No .exe found inside the downloaded archive.")
            with z.open(exe) as src, open(target, "wb") as dst:
                dst.write(src.read())

        print(f"\n✓ Stockfish installed at: {target}")
        print("  You can now start the server (start.bat) and analyze games.")
        return 0

    except Exception as e:  # noqa: BLE001
        print(f"\n✗ Automatic download failed: {e}\n")
        print("Manual steps:")
        print("  1. Go to https://stockfishchess.org/download/")
        print("  2. Download the Windows build and unzip it")
        print(f"  3. Copy stockfish.exe to: {target}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
