/**
 * Módulo de Comunicação com a API (Flask backend)
 */

const BASE_URL = 'http://127.0.0.1:5000';

/**
 * Obtém o catálogo completo de estrelas.
 * @returns {Promise<Array>}
 */
export async function fetchStars() {
    const response = await fetch(`${BASE_URL}/api/stars`);
    if (!response.ok) {
        throw new Error(`Erro ao obter estrelas: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Envia o esqueleto atual para a IA completar com novas arestas e extrair propriedades.
 * @param {Object} payload { skeleton_stars, edges, visible_stars }
 * @returns {Promise<Object>}
 */
export async function completeConstellation(payload) {
    const response = await fetch(`${BASE_URL}/api/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`Erro ao completar constelação: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Solicita a geração do mito para a constelação atual.
 * @param {Object} payload { constellation_name, star_names, stars, properties }
 * @returns {Promise<Object>}
 */
export async function generateMyth(payload) {
    const response = await fetch(`${BASE_URL}/api/myth`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`Erro ao gerar mito: ${response.statusText}`);
    }
    return response.json();
}
