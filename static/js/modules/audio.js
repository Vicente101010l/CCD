const sfx = {
    drone: new Audio('static/audio/drone.mp3'),
    chime: new Audio('static/audio/chime.mp3'),
    ui: new Audio('static/audio/mech.mp3'),
    paper: new Audio('static/audio/paper.mp3')
};

sfx.drone.loop = true;
sfx.drone.volume = 0.15;
sfx.chime.volume = 0.5;
sfx.ui.volume = 0.3;
sfx.paper.volume = 0.8;

let audioUnlocked = false;

export function unlockAudio() {
    if (!audioUnlocked) {
        sfx.drone.play().catch(() => console.warn("Autoplay bloqueado pelo browser"));
        audioUnlocked = true;
    }
}

export function playChime() {
    if (audioUnlocked) {
        sfx.chime.currentTime = 0;
        sfx.chime.play().catch(() => {});
    }
}

export function playUi() {
    if (audioUnlocked) {
        sfx.ui.currentTime = 0;
        sfx.ui.play().catch(() => {});
    }
}

export function playPaper() {
    if (audioUnlocked) {
        sfx.paper.currentTime = 0;
        sfx.paper.play().catch(() => {});
    }
}

window.addEventListener('pointerdown', unlockAudio, { once: true });

document.addEventListener('click', (e) => {
    if (
        e.target.tagName.toLowerCase() === 'button' || 
        e.target.closest('button') || 
        e.target.classList.contains('constellation-label-fixed')
    ) {
        playUi();
    }
});
