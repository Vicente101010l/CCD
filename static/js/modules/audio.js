/**
 * Módulo de Efeitos Sonoros e Áudio Ambiente
 */

const sfx = {
    drone: new Audio('static/audio/drone.mp3'),
    chime: new Audio('static/audio/chime.mp3'),
    ui: new Audio('static/audio/mech.mp3'),
    paper: new Audio('static/audio/paper.mp3')
};

// Configuração padrão
sfx.drone.loop = true;
sfx.drone.volume = 0.15;
sfx.chime.volume = 0.5;
sfx.ui.volume = 0.3;
sfx.paper.volume = 0.8;

let audioUnlocked = false;

/**
 * Tenta iniciar o drone de som ambiente. Chamado ao primeiro toque do utilizador.
 */
export function unlockAudio() {
    if (!audioUnlocked) {
        sfx.drone.play().catch(() => console.warn("Autoplay bloqueado pelo browser"));
        audioUnlocked = true;
    }
}

/**
 * Toca o som de seleção de estrela (carrilhão).
 */
export function playChime() {
    if (audioUnlocked) {
        sfx.chime.currentTime = 0;
        sfx.chime.play().catch(() => {});
    }
}

/**
 * Toca o som de interação mecânica com botões/etiquetas.
 */
export function playUi() {
    if (audioUnlocked) {
        sfx.ui.currentTime = 0;
        sfx.ui.play().catch(() => {});
    }
}

/**
 * Toca o som de pergaminho sendo desenrolado.
 */
export function playPaper() {
    if (audioUnlocked) {
        sfx.paper.currentTime = 0;
        sfx.paper.play().catch(() => {});
    }
}

// Ouvinte global para desbloqueio de áudio ao primeiro clique
window.addEventListener('pointerdown', unlockAudio, { once: true });

// Ouvinte global de cliques para botões ou etiquetas interativas
document.addEventListener('click', (e) => {
    if (
        e.target.tagName.toLowerCase() === 'button' || 
        e.target.closest('button') || 
        e.target.classList.contains('constellation-label-fixed')
    ) {
        playUi();
    }
});
