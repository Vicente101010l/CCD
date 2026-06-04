import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURAÇÃO CENA ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- NAVEGAÇÃO ESTILO PLANETÁRIO ---
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 0, 0.1); 
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableZoom = true;
controls.rotateSpeed = -0.3; // Invertido para parecer rotação natural do pescoço
controls.minDistance = 0.1;
controls.maxDistance = 10;

// --- ESTADO ---
const starRadius = 50;
let userSelectedStars = [];
let userCreatedEdges = [];
let tempLine = null;
let activeStar = null;
let targetCameraPosition = null;
let isCentering = false;
const starsGroup = new THREE.Group();
scene.add(starsGroup);

// --- CRIAR CÉU ESFÉRICO REAL ---
async function loadStars() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/stars');
        const starsData = await response.json();
        
        starsData.forEach(starData => {
            // Mapeamos a magnitude para um tamanho de esfera (estrelas mais brilhantes são maiores)
            // Magnitude aparente mínima no catálogo é -1.44 (Sirius), máxima é 3.80.
            const size = Math.max(0.06, 0.25 - (starData.mag * 0.035));
            
            const geometry = new THREE.SphereGeometry(size, 8, 8); // 8x8 para excelente performance
            const material = new THREE.MeshBasicMaterial({ color: starData.color });
            const star = new THREE.Mesh(geometry, material);
            
            star.position.set(starData.coords.x, starData.coords.y, starData.coords.z);
            star.userData = { 
                id: starData.id, 
                name: starData.name,
                coords: starData.coords,
                con: starData.con,
                mag: starData.mag
            };
            starsGroup.add(star);
        });
        console.log(`Carregadas ${starsData.length} estrelas reais com sucesso.`);
    } catch (err) {
        console.error("Erro ao carregar o catálogo de estrelas:", err);
    }
}
loadStars();

// --- INTERAÇÃO: RAYCASTER E RATO ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    // Apenas responde a cliques no canvas (ignora cliques nos botões/UI)
    if (event.target !== renderer.domElement) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // 1. Tentar interseção exata primeiro
    const intersects = raycaster.intersectObjects(starsGroup.children);
    let clickedStar = null;
    
    if (intersects.length > 0) {
        clickedStar = intersects[0].object;
    } else {
        // 2. Procurar a estrela mais próxima do raio de clique dentro de um limiar
        const threshold = 1.2; // Tolerância em unidades 3D
        const thresholdSq = threshold * threshold;
        let minDistanceSq = Infinity;
        
        starsGroup.children.forEach(star => {
            const distSq = raycaster.ray.distanceSqToPoint(star.position);
            if (distSq < thresholdSq && distSq < minDistanceSq) {
                minDistanceSq = distSq;
                clickedStar = star;
            }
        });
    }

    if (clickedStar) {
        onStarClick({
            id: clickedStar.userData.id,
            name: clickedStar.userData.name,
            coords: { x: clickedStar.position.x, y: clickedStar.position.y, z: clickedStar.position.z },
            con: clickedStar.userData.con,
            mag: clickedStar.userData.mag
        });
    } else {
        deselectActiveStar();
    }
});

// TOOLTIP E LINHA ELÁSTICA (MOUSEMOVE)
const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (event) => {
    // Esconder tooltip se passarmos o rato por cima da UI
    if (event.target !== renderer.domElement) {
        tooltip.style.display = 'none';
        document.body.style.cursor = 'default';
        return;
    }

    // Atualizar coordenadas do rato para o raycaster
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // RAYCASTING PARA HOVER DE ESTRELAS
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(starsGroup.children);
    let hoveredStar = null;

    if (intersects.length > 0) {
        hoveredStar = intersects[0].object;
    } else {
        // Procurar a estrela mais próxima dentro do limiar para mostrar o tooltip
        const threshold = 1.2;
        const thresholdSq = threshold * threshold;
        let minDistanceSq = Infinity;
        
        starsGroup.children.forEach(star => {
            const distSq = raycaster.ray.distanceSqToPoint(star.position);
            if (distSq < thresholdSq && distSq < minDistanceSq) {
                minDistanceSq = distSq;
                hoveredStar = star;
            }
        });
    }

    if (hoveredStar) {
        // Exibir o tooltip premium
        tooltip.innerText = `${hoveredStar.userData.name} (Mag: ${hoveredStar.userData.mag}, ${hoveredStar.userData.con})`;
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
        tooltip.style.display = 'block';
        document.body.style.cursor = 'pointer';
    } else {
        tooltip.style.display = 'none';
        document.body.style.cursor = 'crosshair';
    }

    // LINHA ELÁSTICA (RUBBER-BANDING)
    if (!activeStar) return;

    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(starRadius));

    if (tempLine) scene.remove(tempLine);
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(activeStar.coords.x, activeStar.coords.y, activeStar.coords.z),
        pos
    ]);
    tempLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0xc9a84c, dashSize: 1, gapSize: 0.5 }));
    tempLine.computeLineDistances();
    scene.add(tempLine);
});

// --- LÓGICA DE NEGÓCIO ---
function deselectActiveStar() {
    if (activeStar) {
        const starObj = starsGroup.children.find(s => s.userData.id === activeStar.id);
        if (starObj) {
            starObj.material.color.setHex(0xc9a84c); // Devolve à cor dourada da constelação
        }
        activeStar = null;
        if (tempLine) {
            scene.remove(tempLine);
            tempLine = null;
        }
    }
}

function onStarClick(starData) {
    const starObj = starsGroup.children.find(s => s.userData.id === starData.id);
    if (!starObj) return;

    const alreadySelected = userSelectedStars.find(s => s.id === starData.id);

    if (activeStar) {
        if (activeStar.id === starData.id) {
            // Clicar na estrela ativa cancela a seleção
            deselectActiveStar();
        } else {
            // Criar ligação
            userCreatedEdges.push({ from: activeStar.id, to: starData.id });
            drawVisualLine(activeStar.coords, starData.coords, 0xc9a84c);

            if (!alreadySelected) {
                userSelectedStars.push(starData);
                document.getElementById('star-count').innerText = userSelectedStars.length;
            }

            // Repor a cor da estrela ativa anterior para dourado
            const prevActiveStarObj = starsGroup.children.find(s => s.userData.id === activeStar.id);
            if (prevActiveStarObj) {
                prevActiveStarObj.material.color.setHex(0xc9a84c);
            }

            // Definir a nova estrela ativa e pintá-la a ciano
            activeStar = starData;
            starObj.material.color.setHex(0x00ffff);
        }
    } else {
        // Iniciar nova linha
        if (!alreadySelected) {
            userSelectedStars.push(starData);
            document.getElementById('star-count').innerText = userSelectedStars.length;
        }
        activeStar = starData;
        starObj.material.color.setHex(0x00ffff);
    }
}

function drawVisualLine(start, end, colorHex) {
    const material = new THREE.LineBasicMaterial({ color: colorHex });
    const points = [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    scene.add(new THREE.Line(geometry, material));
}

window.onForgeConstellation = async function() {
    if (userSelectedStars.length < 2) {
        alert("Por favor, liga pelo menos 2 estrelas para forjar uma constelação!");
        return;
    }
    if (tempLine) scene.remove(tempLine);

    // Obter referências dos elementos
    const forgeBtn = document.getElementById('forge-btn');
    const mythLoading = document.getElementById('myth-loading');
    const mythContent = document.getElementById('myth-content');
    const sidebar = document.getElementById('interface-myth');
    const divider = document.getElementById('myth-divider');

    // Desativar o botão e iniciar estado de carregamento
    forgeBtn.disabled = true;
    forgeBtn.innerText = 'A FORJAR...';
    forgeBtn.style.opacity = '0.6';

    // Abrir imediatamente a sidebar com o loading spinner visível
    mythContent.style.display = 'none';
    mythLoading.style.display = 'flex';
    sidebar.classList.add('visible');
    if (divider) divider.style.display = 'block';

    try {
        const payload = { skeleton_stars: userSelectedStars, edges: userCreatedEdges };
        const response = await fetch('http://127.0.0.1:5000/api/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        result.ai_edges.forEach(edge => {
            const fromStarObj = starsGroup.children.find(s => s.userData.id === edge.from);
            const toStarObj = starsGroup.children.find(s => s.userData.id === edge.to);
            if (fromStarObj && toStarObj) {
                drawVisualLine(
                    { x: fromStarObj.position.x, y: fromStarObj.position.y, z: fromStarObj.position.z },
                    { x: toStarObj.position.x, y: toStarObj.position.y, z: toStarObj.position.z },
                    0xa8c4e0
                );
            }
        });

        const mythRes = await fetch('http://127.0.0.1:5000/api/myth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                constellation_name: "Nova Constelação",
                star_names: userSelectedStars.map(s => s.name),
                stars: userSelectedStars.map(s => ({ name: s.name, con: s.con })),
                properties: result.properties
            })
        });

        const myth = await mythRes.json();
        
        const badge = document.getElementById('myth-badge');
        if (myth.is_real) {
            badge.innerText = `Constelação Real: ${myth.real_name}`;
            badge.className = 'badge-real';
            badge.style.display = 'inline-block';
        } else {
            badge.innerText = `Constelação Criada: ${myth.real_name}`;
            badge.className = 'badge-custom';
            badge.style.display = 'inline-block';
        }
        
        document.getElementById('myth-title').innerText = myth.titulo;
        document.getElementById('myth-text').innerText = myth.texto;
        
        // Esconder loading e mostrar conteúdo do mito
        mythLoading.style.display = 'none';
        mythContent.style.display = 'block';

        // ANIMAR E CENTRAR CÂMARA NA CONSTELAÇÃO (LOCK-IN)
        if (userSelectedStars.length > 0) {
            const centroid = new THREE.Vector3();
            userSelectedStars.forEach(s => {
                centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z));
            });
            centroid.divideScalar(userSelectedStars.length);
            
            const dir = centroid.clone().normalize();
            targetCameraPosition = dir.clone().multiplyScalar(-camera.position.length());
            isCentering = true;
        }
    } catch (err) {
        console.error("Erro ao forjar constelação:", err);
        sidebar.classList.remove('visible');
        if (divider) divider.style.display = 'none';
    } finally {
        // Restaurar estado do botão
        forgeBtn.disabled = false;
        forgeBtn.innerText = 'GERAR MITO';
        forgeBtn.style.opacity = '1';
    }
}

// Fechar sidebar do mito
window.closeMythSidebar = function() {
    document.getElementById('interface-myth').classList.remove('visible');
    const divider = document.getElementById('myth-divider');
    if (divider) divider.style.display = 'none';
};

// Se o utilizador começar a rodar manualmente, cancela a focagem automática para não disputar o controlo
controls.addEventListener('start', () => {
    isCentering = false;
});

// --- CONTROLO DE ZOOM (SLIDER E BOTÕES) ---
const zoomSlider = document.getElementById('zoom-slider');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');

function updateCameraZoom(distance) {
    const clampedDist = Math.max(0.1, Math.min(10, distance));
    const dir = camera.position.clone().normalize();
    camera.position.copy(dir.multiplyScalar(clampedDist));
    controls.update();
    if (zoomSlider) {
        zoomSlider.value = 10.1 - clampedDist;
    }
}

if (zoomSlider) {
    // Sincronizar o valor inicial do slider com a câmara
    zoomSlider.value = 10.1 - camera.position.length();
    
    // Escutar mudanças no slider
    zoomSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const distance = 10.1 - val;
        updateCameraZoom(distance);
    });
}

// Botões + e -
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        const currentDist = camera.position.length();
        updateCameraZoom(currentDist - 0.6); // Aproximar
    });
}
if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        const currentDist = camera.position.length();
        updateCameraZoom(currentDist + 0.6); // Afastar
    });
}

// Sincronizar o slider com o scroll do rato (roda de zoom) do OrbitControls
controls.addEventListener('change', () => {
    if (zoomSlider && !isCentering) {
        zoomSlider.value = 10.1 - camera.position.length();
    }
});

function animate() {
    requestAnimationFrame(animate);
    
    if (isCentering && targetCameraPosition) {
        camera.position.lerp(targetCameraPosition, 0.05);
        if (camera.position.distanceTo(targetCameraPosition) < 0.001) {
            camera.position.copy(targetCameraPosition);
            isCentering = false;
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}
animate();