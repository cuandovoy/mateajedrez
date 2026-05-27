import re
import time
from html.parser import HTMLParser
from typing import Optional

import pandas as pd
import requests

# ============================================================
# CONFIGURACIÓN
# ============================================================
INPUT_FILE = "gimnasios_cdmx.xlsx"
OUTPUT_FILE = "gimnasios_cdmx_contacto.xlsx"
GUARDAR_CADA = 20
TIMEOUT = 10

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

SOCIAL_DOMAINS = {
    "Instagram": ["instagram.com"],
    "Facebook": ["facebook.com", "fb.com", "fb.me"],
    "TikTok": ["tiktok.com"],
    "Twitter": ["twitter.com", "x.com"],
    "YouTube": ["youtube.com", "youtu.be"],
    "WhatsApp": ["wa.me", "api.whatsapp.com"],
}

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
SKIP_EMAIL_PATTERNS = [
    "example.com", "domain.com", "email.com", "test.com",
    "sentry.io", "wixpress.com", "squarespace.com", "wordpress.com",
    "schema.org", "w3.org",
]

# ============================================================


class LinkExtractor(HTMLParser):
    """Parser minimalista que extrae todos los href sin dependencias externas."""

    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for attr, value in attrs:
                if attr == "href" and value:
                    self.links.append(value)


def extraer_links(html: str) -> list:
    parser = LinkExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.links


def strip_tags(html: str) -> str:
    """Elimina tags HTML para buscar emails en texto plano."""
    return re.sub(r"<[^>]+>", " ", html)


def normalizar_url(url: str) -> Optional[str]:
    url = url.strip()
    if not url or url == "nan":
        return None
    if not url.startswith("http"):
        url = "https://" + url
    return url


def scrape_website(raw_url: str) -> dict:
    url = normalizar_url(raw_url)
    if not url:
        return {}

    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text
    except Exception:
        return {}

    result = {}
    all_links = extraer_links(html)

    # --- Emails ---
    emails = set()

    for link in all_links:
        if link.startswith("mailto:"):
            email = link[7:].split("?")[0].strip().lower()
            if "@" in email:
                emails.add(email)

    for email in EMAIL_REGEX.findall(strip_tags(html)):
        emails.add(email.lower())

    emails = {
        e for e in emails
        if not any(skip in e for skip in SKIP_EMAIL_PATTERNS)
    }
    if emails:
        result["Email"] = ", ".join(sorted(emails))

    # --- Redes sociales ---
    for platform, domains in SOCIAL_DOMAINS.items():
        for link in all_links:
            if link.startswith("http") and any(d in link for d in domains):
                result[platform] = link
                break

    return result


def guardar(registros: list, archivo: str) -> None:
    df = pd.DataFrame(registros)
    with pd.ExcelWriter(archivo, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Contactos")


def main():
    print(f"📂 Leyendo {INPUT_FILE}...")

    dfs = []
    for sheet in ["Con Teléfono", "Sin Teléfono"]:
        try:
            dfs.append(pd.read_excel(INPUT_FILE, sheet_name=sheet))
        except Exception:
            pass

    if not dfs:
        print("❌ No se encontró el archivo. Corré primero script.py.")
        return

    df = pd.concat(dfs, ignore_index=True).drop_duplicates(subset=["Nombre"])
    total = len(df)
    print(f"✅ {total} gimnasios cargados\n")

    registros = []

    for i, (_, row) in enumerate(df.iterrows()):
        nombre = row.get("Nombre", "")
        website = str(row.get("Sitio Web", "")).strip() if pd.notna(row.get("Sitio Web")) else ""

        print(f"  [{i + 1}/{total}] {nombre}...", end=" ", flush=True)

        datos = {
            "Nombre": nombre,
            "Teléfono": row.get("Teléfono", ""),
            "Dirección": row.get("Dirección", ""),
            "Sitio Web": website,
            "Calificación": row.get("Calificación", ""),
            "Cantidad de Reseñas": row.get("Cantidad de Reseñas", ""),
            "Email": "",
            "Instagram": "",
            "Facebook": "",
            "TikTok": "",
            "Twitter": "",
            "YouTube": "",
            "WhatsApp": "",
        }

        if website:
            scraped = scrape_website(website)
            for key in ["Email", "Instagram", "Facebook", "TikTok", "Twitter", "YouTube", "WhatsApp"]:
                datos[key] = scraped.get(key, "")
            encontrado = [k for k in ["Email", "Instagram", "Facebook"] if scraped.get(k)]
            print(f"✅ {', '.join(encontrado) if encontrado else 'sin datos'}")
        else:
            print("⚠️  sin sitio web")

        registros.append(datos)

        if (i + 1) % GUARDAR_CADA == 0:
            guardar(registros, OUTPUT_FILE)
            print(f"  💾 Guardado parcial: {i + 1}/{total}")

        time.sleep(0.5)

    guardar(registros, OUTPUT_FILE)

    df_out = pd.DataFrame(registros)
    con_email = len(df_out[df_out["Email"] != ""])
    con_ig = len(df_out[df_out["Instagram"] != ""])
    con_fb = len(df_out[df_out["Facebook"] != ""])
    con_tk = len(df_out[df_out["TikTok"] != ""])
    sin_web = len(df_out[df_out["Sitio Web"] == ""])

    print(f"\n✅ ¡Listo! Archivo guardado: {OUTPUT_FILE}")
    print(f"   📧 Con email:      {con_email}")
    print(f"   📸 Con Instagram:  {con_ig}")
    print(f"   👍 Con Facebook:   {con_fb}")
    print(f"   🎵 Con TikTok:     {con_tk}")
    print(f"   🌐 Sin sitio web:  {sin_web} (no se procesaron)")


if __name__ == "__main__":
    main()
