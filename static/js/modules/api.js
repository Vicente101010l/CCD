const BASE_URL = 'http://127.0.0.1:5000';

export async function fetchStars() {
    const response = await fetch(`${BASE_URL}/api/stars`);
    if (!response.ok) {
        throw new Error(`Erro ao obter estrelas: ${response.statusText}`);
    }
    return response.json();
}

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
