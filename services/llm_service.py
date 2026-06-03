import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def get_ai_completion(properties, skeleton_names, candidates):
    prompt = f"""
    CONTEXTO: Sistema de co-criação de constelações.
    ESTRUTURA ATUAL: Estrelas: {', '.join(skeleton_names)}.
    PROPRIEDADES DO GRAFO: {properties}.
    CANDIDATOS DISPONÍVEIS: {candidates}.

    TAREFA: Escolhe entre 2 a 4 novas conexões da lista de CANDIDATOS que melhor complementem a forma.
    REGRAS RÍGIDAS:
    1. Responde APENAS em JSON.
    2. Usa apenas IDs presentes nos candidatos.
    3. Justifica a escolha baseada na geometria (campo 'reason').
    
    JSON FORMAT:
    {{ "new_edges": [ {{"from": ID, "to": ID, "reason": "texto"}} ] }}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": "És um curador de formas celestiais."},
                  {"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return completion.choices[0].message.content

def generate_myth(constellation_name, full_star_names, properties):
    prompt = f"""
    CONTEXTO: Sistema de co-criação e simulação de constelações.
    O utilizador desenhou uma nova constelação unindo as estrelas: {', '.join(full_star_names)}.
    
    MÉTRICAS CIENTÍFICAS E ARQUÉTIPOS ANCESTRAIS CALCULADOS:
    1. Silhueta Ancestral (Forma física): '{properties.get('silhueta_ancestral', 'Indefinida')}'
    2. Temperamento Elemental (Cor/Espectro): '{properties.get('temperamento_elemental', 'Indefinido')}'
    3. Estatuto Divino (Brilho/Magnitude): '{properties.get('estatuto_divino', 'Indefinido')}'
    4. Zona Cósmica/Eternidade (Latitude Celestial Z): '{properties.get('zona_cosmica', 'Indefinida')}'
    
    INFORMAÇÕES DE SUPORTE:
    - Assimetria ({properties['asymmetry']})
    - Elongação ({properties['elongation']})
    - Ciclos ({properties['has_cycles']})

    TAREFA:
    1. Inventa um nome poético, clássico e evocativo em português para esta nova constelação (ex: "Serpente das Águas Prateadas", "O Escudo do Rei Caído", "A Besta de Gelo Celeste"). O nome deve estar diretamente alinhado com a 'Silhueta Ancestral' e o 'Temperamento Elemental' obtidos.
    2. Cria um mito grego/clássico original que narre a história desta constelação. O mito deve justificar a sua colocação no céu (catasterismo) de acordo com:
       - O 'Temperamento Elemental': Se Espiritual (foca em magia, deuses, raios, gelo), se Terrestre (foca em fogo, sacrifício, sangue, terra, dinastias), se Equilibrado (foca em justiça, luz solar, éter, harmonia).
       - O 'Estatuto Divino': Se Divino (foca nas divindades supremas do Olimpo), se Heroico (foca em semideuses e monstros protetores), se Mortal (foca em contos de mortais, animais comuns e ferramentas).
       - A 'Zona Cósmica': Se Polar (a história foca-se na imortalidade, no tempo sem fim ou em sentinelas que nunca dormem/nunca se põem), se Equatorial (a história foca-se nas estações do ano, colheitas, nascimento, morte e renovação terrena).
    
    Deves usar os nomes das estrelas selecionadas ({', '.join(full_star_names)}) como personagens principais, deuses ou objetos sagrados na tua lenda.

    REGRAS DE ESCRITA:
    - 3 a 5 parágrafos narrativos.
    - Escreve em Português Europeu corrido e natural.
    - Mantém o tom literário elevado de mitologia clássica.
    - Responde EXCLUSIVAMENTE em formato JSON com as chaves indicadas.
    
    JSON FORMAT:
    {{
      "nome_constelacao": "NOME INVENTADO DA CONSTELAÇÃO",
      "titulo": "TÍTULO DA LENDA / MITO",
      "texto": "TEXTO DA LENDA MITOLÓGICA COMPLETO"
    }}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "És um mitógrafo clássico que escreve em Português Europeu corrido."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    return completion.choices[0].message.content