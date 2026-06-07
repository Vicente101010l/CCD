import { playPaper } from './audio.js';

const toast = document.getElementById('notificacao-sistema');
const overlay = document.getElementById('sistema-modal-overlay');
const titulo = document.getElementById('modal-titulo');
const msg = document.getElementById('modal-mensagem');
const input = document.getElementById('modal-input');
const btnCancelar = document.getElementById('modal-btn-cancelar');
const btnConfirmar = document.getElementById('modal-btn-confirmar');

const scrollZone = document.getElementById('scroll-container');
const papiro = document.getElementById('mesh-papiro-corpo');
const rTopo = document.getElementById('mesh-rolo-topo');
const rBase = document.getElementById('mesh-rolo-base');
const aviso = document.getElementById('puxador-aviso');
const barraControlos = document.getElementById('controls-panel');

export function mostrarNotificacao(mensagem) {
    if (!toast) return;
    toast.innerText = mensagem;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
window.mostrarNotificacao = mostrarNotificacao;

export function mostrarModalCustom(tipo, message, valorDefeito = "") {
    return new Promise((resolve) => {
        if (!overlay) {
            resolve(null);
            return;
        }

        const btnCancel = document.getElementById('modal-btn-cancelar');
        const btnConfirm = document.getElementById('modal-btn-confirmar');

        msg.innerText = message;
        if (tipo === 'prompt') {
            titulo.innerText = 'REGISTAR CONSTELAÇÃO';
            input.style.display = 'block';
            input.value = valorDefeito;
        } else if (tipo === 'confirm') {
            titulo.innerText = 'AVISO DO SISTEMA';
            input.style.display = 'none';
            input.value = '';
        }

        overlay.classList.add('show');
        if (tipo === 'prompt') input.focus();

        btnCancel.onclick = null;
        btnConfirm.onclick = null;

        btnCancel.addEventListener('click', () => {
            overlay.classList.remove('show');
            resolve(null);
        });

        btnConfirm.addEventListener('click', () => {
            overlay.classList.remove('show');
            resolve(tipo === 'prompt' ? input.value : true);
        });
    });
}
window.mostrarModalCustom = mostrarModalCustom;

export function desenrolarPergaminho() {
    if (!papiro || papiro.classList.contains('aberto')) return;
    
    papiro.classList.add('aberto');
    playPaper();

    if (aviso) {
        aviso.style.opacity = '0';
        aviso.style.visibility = 'hidden';
    }
    
    if (rTopo && rBase) {
        rTopo.style.transform = 'rotateX(720deg)';
        rBase.style.transform = 'rotateX(720deg)';
        setTimeout(() => { sincronizarRotacaoMecanica(); }, 800);
    }
}
window.desenrolarPergaminho = desenrolarPergaminho;

export function sincronizarRotacaoMecanica() {
    if (!scrollZone || !rTopo || !rBase || !papiro || !papiro.classList.contains('aberto')) return;
    const st = scrollZone.scrollTop;
    const degrees = (st * 1.35) % 360;
    rTopo.style.transform = `rotateX(${degrees}deg)`;
    rBase.style.transform = `rotateX(${degrees}deg)`;
}

if (scrollZone) {
    scrollZone.addEventListener('scroll', sincronizarRotacaoMecanica);
}

export async function animarFasesCarregamento(textEl, loadingScreen) {
    const fases = [
        "A calcular o baricentro estelar...",
        "A avaliar o índice de alongamento da estrutura...",
        "A medir o coeficiente de assimetria...",
        "A mapear ciclos na rede topológica...",
        "A invocar o motor semântico..."
    ];
    
    if (!textEl) return;
    textEl.classList.remove('visible');
    
    for (let fase of fases) {
        if (loadingScreen && loadingScreen.style.display === 'none') break;
        textEl.innerText = fase;
        textEl.classList.add('visible');
        await new Promise(resolve => setTimeout(resolve, 1400));
        if (loadingScreen && loadingScreen.style.display === 'none') break;
        textEl.classList.remove('visible');
        await new Promise(resolve => setTimeout(resolve, 400));
    }
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
            const interfaceMyth = document.getElementById('interface-myth');
            const modeSwitcher = document.getElementById('mode-switcher');
            
            if (interfaceMyth && interfaceMyth.classList.contains('visible')) {
                if (barraControlos) barraControlos.classList.add('shifted');
                if (modeSwitcher) modeSwitcher.classList.add('hidden');
            } else {
                if (barraControlos) barraControlos.classList.remove('shifted');
                if (papiro) papiro.classList.remove('aberto');
                if (modeSwitcher) modeSwitcher.classList.remove('hidden');
                
                if (aviso) {
                    aviso.style.opacity = '1';
                    aviso.style.visibility = 'visible';
                }
                if (rTopo) rTopo.style.transform = 'rotateX(0deg)';
                if (rBase) rBase.style.transform = 'rotateX(0deg)';
                if (scrollZone) scrollZone.scrollTop = 0;
            }
        }
    });
});

const interfaceMythEl = document.getElementById('interface-myth');
if (interfaceMythEl) { 
    observer.observe(interfaceMythEl, { attributes: true }); 
}
