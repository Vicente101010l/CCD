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
    Cria um mito para a constelação '{constellation_name}'.
    PERSONAGENS (Estrelas): {', '.join(full_star_names)}.
    GUIA ESTRUTURAL:
    - Assimetria ({properties['asymmetry']}): Se alta, foca em injustiça ou caos.
    - Elongação ({properties['elongation']}): Se alta, foca em viagens ou exílio.
    - Ciclos ({properties['has_cycles']}): Se verdadeiro, foca em prisões ou ciclos eternos.

    REGRAS: 3 a 5 parágrafos narrativos. Português Europeu. Estilo mitologia clássica.
    JSON FORMAT: {{ "titulo": "NOME DO MITO", "texto": "TEXTO DO MITO" }}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "És um mitógrafo clássico que escreve em Português Europeu corrido."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    # O RETURN QUE FALTAVA:
    return completion.choices[0].message.content