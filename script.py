import requests
import pandas as pd
import time

# ============================================================
# CONFIGURACIÓN - Poné tu API Key de Google Places acá
# ============================================================
API_KEY = "AIzaSyBA2QqK0Aw7B8rRwo4FOBJa6k7DdLvfQ-g"

# Rubros a buscar (podés agregar o sacar los que quieras)
RUBROS = [
    "casa de decoración",
    "decoración del hogar",
    "tienda de muebles",
    "bazar decoración",
    "tienda de regalos",
    "decoración interior",
    "artículos para el hogar",
    "cuadros y marcos",
    "iluminación decorativa",
]

# Zona de búsqueda: centro de Montevideo
LOCATION = "-34.9011,-56.1645"  # lat,lng de Montevideo
RADIUS = 15000  # 15km de radio (cubre gran Montevideo)

# ============================================================


def buscar_lugares(query):
    """Busca lugares usando Text Search de Google Places API"""
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    resultados = []
    next_page_token = None

    while True:
        params = {
            "query": f"{query} Montevideo Uruguay",
            "location": LOCATION,
            "radius": RADIUS,
            "key": API_KEY,
            "language": "es",
        }
        if next_page_token:
            params["pagetoken"] = next_page_token

        response = requests.get(url, params=params)
        data = response.json()

        if data.get("status") not in ["OK", "ZERO_RESULTS"]:
            print(f"  ⚠️  Error en búsqueda '{query}': {data.get('status')} — {data.get('error_message', 'sin detalle')}")
            break

        for place in data.get("results", []):
            resultados.append(place["place_id"])

        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break

        time.sleep(2)  # Espera requerida entre páginas

    return resultados


def obtener_detalle(place_id):
    """Obtiene nombre, teléfono y dirección de un lugar"""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,formatted_address,website,rating,user_ratings_total",
        "key": API_KEY,
        "language": "es",
    }

    response = requests.get(url, params=params)
    data = response.json()

    if data.get("status") == "OK":
        result = data["result"]
        return {
            "Nombre": result.get("name", ""),
            "Teléfono": result.get("formatted_phone_number", "Sin teléfono"),
            "Dirección": result.get("formatted_address", ""),
            "Sitio Web": result.get("website", ""),
            "Calificación": result.get("rating", ""),
            "Cantidad de Reseñas": result.get("user_ratings_total", ""),
        }
    return None


def main():
    print("🔍 Iniciando búsqueda de locales en Montevideo...\n")

    todos_los_ids = set()  # Usamos set para evitar duplicados

    # 1. Recolectar todos los place_ids
    for rubro in RUBROS:
        print(f"  Buscando: {rubro}...")
        ids = buscar_lugares(rubro)
        todos_los_ids.update(ids)
        print(f"  ✅ {len(ids)} encontrados (total acumulado: {len(todos_los_ids)})")
        time.sleep(1)

    print(f"\n📋 Total únicos encontrados: {len(todos_los_ids)}")
    print("📞 Obteniendo detalles (teléfonos, direcciones)...\n")

    # 2. Obtener detalles de cada lugar (guardando cada 25)
    GUARDAR_CADA = 25
    archivo = "locales_montevideo.xlsx"
    locales = []

    def guardar(locales):
        df = pd.DataFrame(locales)
        df_con = df[df["Teléfono"] != "Sin teléfono"].copy()
        df_sin = df[df["Teléfono"] == "Sin teléfono"].copy()
        df_con["Cantidad de Reseñas"] = pd.to_numeric(df_con["Cantidad de Reseñas"], errors="coerce").fillna(0).astype(int)
        df_con = df_con.sort_values("Cantidad de Reseñas", ascending=False)
        with pd.ExcelWriter(archivo, engine="openpyxl") as writer:
            df_con.to_excel(writer, sheet_name="Con Teléfono", index=False)
            df_sin.to_excel(writer, sheet_name="Sin Teléfono", index=False)

    total = len(todos_los_ids)
    for i, place_id in enumerate(todos_los_ids):
        detalle = obtener_detalle(place_id)
        if detalle:
            locales.append(detalle)

        if (i + 1) % GUARDAR_CADA == 0:
            guardar(locales)
            print(f"  💾 Guardado parcial: {i + 1}/{total} procesados ({len(locales)} con datos)")

        time.sleep(0.1)

    # Guardado final
    guardar(locales)

    df_final = pd.DataFrame(locales)
    con = len(df_final[df_final["Teléfono"] != "Sin teléfono"])
    sin = len(df_final[df_final["Teléfono"] == "Sin teléfono"])
    print(f"\n✅ ¡Listo! Archivo guardado: {archivo}")
    print(f"   📱 Con teléfono: {con} locales")
    print(f"   ❌ Sin teléfono: {sin} locales")
    print(f"\n💡 Abrí '{archivo}' y ya tenés los números para WhatsApp")


if __name__ == "__main__":
    main()