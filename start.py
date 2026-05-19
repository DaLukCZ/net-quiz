import http.server
import os
import platform
import subprocess
import sys
import threading
import time
import webbrowser

URL = "http://localhost:8000/net-quiz/"
PORT = 8000

def open_browser():
    time.sleep(1)
    webbrowser.open(URL)

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print()
print("╔════════════════════════════════════════╗")
print("║         NetQuiz - Spuštění             ║")
print("╚════════════════════════════════════════╝")
print()
print(f"✓ Python {sys.version.split()[0]} nalezen ({platform.system()})")
print()
print("🌐 Spouštím server...")
print()
print(f"📍 Otevři v prohlížeči: {URL}")
print()
print("ℹ️  Zavřít server: Zmáčkni Ctrl+C")
print()

threading.Thread(target=open_browser, daemon=True).start()

try:
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *args: None
    with http.server.HTTPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n\nServer zastaven.")
except OSError as e:
    print(f"\n❌ Chyba: {e}")
    print(f"   Port {PORT} je možná již obsazený.")
    input("Stiskni Enter pro zavření...")
    sys.exit(1)
