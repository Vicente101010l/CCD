import urllib.request
import csv
import json
import math
import os

CSV_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/master/hyg/CURRENT/hygdata_v41.csv"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "static", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "stars.json")
MAX_MAGNITUDE = 3.8  # Filtrar para ter cerca de 250 a 300 estrelas

def get_star_color(ci_str):
    try:
        ci = float(ci_str)
    except (ValueError, TypeError):
        ci = 0.6  # Default para estrelas tipo Sol (amarela/branca)
    
    # Mapeamento estético de B-V color index para cores hexadecimais
    if ci < -0.3:
        return "#9bb0ff"  # Super Azul
    elif ci < 0.0:
        return "#aabfff"  # Azul-Branco
    elif ci < 0.3:
        return "#e3e7ff"  # Branco
    elif ci < 0.6:
        return "#f8f7ff"  # Amarelo-Branco (F-type)
    elif ci < 0.9:
        return "#fff4ea"  # Amarelo (G-type)
    elif ci < 1.4:
        return "#ffd2a1"  # Laranja (K-type)
    else:
        return "#ff9e3a"  # Vermelho-Laranja (M-type)

def main():
    print(f"A descarregar catálogo HYG de: {CSV_URL} ...")
    temp_csv_path = os.path.join(os.path.dirname(__file__), "hyg_temp.csv")
    
    try:
        urllib.request.urlretrieve(CSV_URL, temp_csv_path)
        print("Download concluído com sucesso.")
    except Exception as e:
        print(f"Erro ao descarregar o ficheiro: {e}")
        return

    stars = []
    
    with open(temp_csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Filtrar o Sol
                if row['proper'] == 'Sol' or row['id'] == '0':
                    continue
                
                mag = float(row['mag'])
                if mag > MAX_MAGNITUDE:
                    continue
                
                # Coordenadas originais no catálogo
                x = float(row['x'])
                y = float(row['y'])
                z = float(row['z'])
                
                dist = math.sqrt(x*x + y*y + z*z)
                if dist == 0:
                    continue
                
                # Projetar na esfera celeste de raio 50 (Three.js celestial sphere)
                radius = 50.0
                proj_x = (x / dist) * radius
                proj_y = (y / dist) * radius
                proj_z = (z / dist) * radius
                
                # Determinar o nome mais legível da estrela
                name = ""
                if row['proper'].strip():
                    name = row['proper'].strip()
                elif row['bf'].strip():
                    name = row['bf'].strip()
                elif row['hr'].strip():
                    name = f"HR {row['hr'].strip()}"
                elif row['hd'].strip():
                    name = f"HD {row['hd'].strip()}"
                else:
                    name = f"HIP {row['hip'].strip()}" if row['hip'].strip() else f"Estrela {row['id']}"
                
                color = get_star_color(row['ci'])
                
                stars.append({
                    "id": int(row['id']),
                    "name": name,
                    "coords": {
                        "x": round(proj_x, 4),
                        "y": round(proj_y, 4),
                        "z": round(proj_z, 4)
                    },
                    "mag": round(mag, 2),
                    "color": color,
                    "con": row['con'].strip()
                })
            except (ValueError, KeyError) as e:
                continue

    # Ordenar por magnitude (as mais brilhantes primeiro)
    stars.sort(key=lambda s: s['mag'])

    # Assegurar que a pasta de destino existe
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(stars, f, indent=2, ensure_ascii=False)
        
    print(f"Ficheiro guardado com sucesso em: {OUTPUT_FILE}")
    print(f"Total de estrelas reais extraídas: {len(stars)}")
    
    # Limpar o ficheiro temporário
    if os.path.exists(temp_csv_path):
        os.remove(temp_csv_path)

if __name__ == "__main__":
    main()
