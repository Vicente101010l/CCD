import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 0, 0.1); 
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableZoom = true;
controls.rotateSpeed = -0.3;
controls.minDistance = 0.1;
controls.maxDistance = 8.0;

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
}
const starTexture = createStarTexture();

function createCosmicDust() {
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 6000;
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);
    
    for (let i = 0; i < dustCount * 3; i += 3) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 65.0; 
        
        positions[i] = r * Math.sin(phi) * Math.cos(theta);
        positions[i+1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i+2] = r * Math.cos(phi);
        
        colors[i] = 0.6 + Math.random() * 0.2;
        colors[i+1] = 0.7 + Math.random() * 0.2;
        colors[i+2] = 0.9 + Math.random() * 0.1;
    }
    
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const dustMaterial = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true
    });
    
    const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustPoints);
}
createCosmicDust();

const zoomSlider = document.getElementById('zoom-slider');
const zoomVal = document.getElementById('zoom-val');

if (zoomSlider && zoomVal) {
    zoomSlider.addEventListener('input', () => {
        const val = parseFloat(zoomSlider.value);
        const dir = camera.position.clone().normalize();
        camera.position.copy(dir.multiplyScalar(val));
        controls.update();
        
        const percent = Math.round(((val - 0.1) / (8.0 - 0.1)) * 700 + 100);
        zoomVal.innerText = `${percent}%`;
    });
}

controls.addEventListener('change', () => {
    if (zoomSlider && zoomVal) {
        const currentDist = camera.position.length();
        zoomSlider.value = currentDist;
        
        const percent = Math.round(((currentDist - 0.1) / (8.0 - 0.1)) * 700 + 100);
        zoomVal.innerText = `${percent}%`;
    }
});

const starRadius = 50;
let userSelectedStars = [];
let userCreatedEdges = [];
let aiCreatedEdges = [];
let tempLine = null;
let activeStar = null;
let targetCameraPosition = null;
let isCentering = false;
let currentMythData = null;
const starsGroup = new THREE.Group();
const linesGroup = new THREE.Group();
scene.add(starsGroup);
scene.add(linesGroup);

async function loadStars() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/stars');
        const starsData = await response.json();
        
        starsData.forEach(starData => {
            const size = Math.max(0.12, 0.7 - (starData.mag * 0.11));
            
            const material = new THREE.SpriteMaterial({ 
                map: starTexture,
                color: new THREE.Color(starData.color),
                transparent: true,
                blending: THREE.AdditiveBlending 
            });
            const star = new THREE.Sprite(material);
            star.scale.set(size, size, 1);
            
            star.position.set(starData.coords.x, starData.coords.y, starData.coords.z);
            star.userData = { 
                id: starData.id, 
                name: starData.name,
                coords: starData.coords,
                con: starData.con,
                mag: starData.mag,
                color: starData.color,
                originalScale: size // Guardamos o tamanho original para o efeito hover
            };
            starsGroup.add(star);
        });
    } catch (err) {
        console.error("Erro ao carregar estrelas:", err);
    }
}
loadStars();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (event.target !== renderer.domElement) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(starsGroup.children);
    let clickedStar = null;
    
    if (intersects.length > 0) {
        clickedStar = intersects[0].object;
    } else {
        const threshold = 1.2; 
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

const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (event) => {
    if (document.getElementById('forge-btn').disabled) return;

    if (event.target !== renderer.domElement) {
        tooltip.style.display = 'none';
        document.body.style.cursor = 'default';
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(starsGroup.children);
    let hoveredStar = null;

    if (intersects.length > 0) {
        hoveredStar = intersects[0].object;
    } else {
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

    // EFEITO HOVER MAGNÉTICO
    if (hoveredStar) {
        hoveredStar.scale.set(hoveredStar.userData.originalScale * 1.6, hoveredStar.userData.originalScale * 1.6, 1);
        
        tooltip.innerText = `${hoveredStar.userData.name} (Mag: ${hoveredStar.userData.mag}, ${hoveredStar.userData.con})`;
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
        tooltip.style.display = 'block';
        document.body.style.cursor = 'pointer';
    } else {
        starsGroup.children.forEach(star => {
            const os = star.userData.originalScale;
            star.scale.set(os, os, 1);
        });
        
        tooltip.style.display = 'none';
        document.body.style.cursor = 'crosshair';
    }

    if (!activeStar) return;

    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(starRadius));

    if (tempLine) scene.remove(tempLine);
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(activeStar.coords.x, activeStar.coords.y, activeStar.coords.z),
        pos
    ]);
    tempLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0xc9a84c, dashSize: 0.8, gapSize: 0.4 }));
    tempLine.computeLineDistances();
    scene.add(tempLine);
});

function deselectActiveStar() {
    if (activeStar) {
        const starObj = starsGroup.children.find(s => s.userData.id === activeStar.id);
        if (starObj) starObj.material.color.setHex(0xc9a84c); 
        activeStar = null;
        if (tempLine) { scene.remove(tempLine); tempLine = null; }
    }
}

function onStarClick(starData) {
    const onboarding = document.getElementById('onboarding-msg');
    if (onboarding) { onboarding.style.display = 'none'; onboarding.remove(); }
    
    if (window.sfx) {
        window.sfx.chime.currentTime = 0;
        window.sfx.chime.play().catch(() => {});
    }

    const starObj = starsGroup.children.find(s => s.userData.id === starData.id);
    if (!starObj) return;

    const alreadySelected = userSelectedStars.find(s => s.id === starData.id);

    if (activeStar) {
        if (activeStar.id === starData.id) { deselectActiveStar(); } 
        else {
            userCreatedEdges.push({ from: activeStar.id, to: starData.id });
            drawVisualLine(activeStar.coords, starData.coords, 0xc9a84c);
            if (!alreadySelected) {
                userSelectedStars.push(starData);
                document.getElementById('star-count').innerText = userSelectedStars.length;
            }
            const prevActiveStarObj = starsGroup.children.find(s => s.userData.id === activeStar.id);
            if (prevActiveStarObj) prevActiveStarObj.material.color.setHex(0xc9a84c);
            activeStar = starData;
            starObj.material.color.setHex(0x00ffff); 
        }
    } else {
        if (!alreadySelected) {
            userSelectedStars.push(starData);
            document.getElementById('star-count').innerText = userSelectedStars.length;
        }
        activeStar = starData;
        starObj.material.color.setHex(0x00ffff);
    }
}

function drawVisualLine(start, end, colorHex) {
    const material = new THREE.LineBasicMaterial({ 
        color: colorHex, 
        transparent: true, 
        opacity: 0.8 
    });
    
    // Criamos a geometria inicial com apenas o ponto de partida
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 pontos * 3 coordenadas
    positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
    positions[3] = start.x; positions[4] = start.y; positions[5] = start.z; // Ponto final começa igual ao inicial
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, material);
    linesGroup.add(line);

    // Animação manual do traço
    const duration = 400; // 400ms para desenhar
    const startTime = performance.now();

    function animateLine(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Interpola a posição do ponto final em direção ao destino
        const currentEnd = new THREE.Vector3().lerpVectors(start, end, progress);
        
        const pos = line.geometry.attributes.position.array;
        pos[3] = currentEnd.x;
        pos[4] = currentEnd.y;
        pos[5] = currentEnd.z;
        line.geometry.attributes.position.needsUpdate = true;

        if (progress < 1) {
            requestAnimationFrame(animateLine);
        }
    }
    requestAnimationFrame(animateLine);
}
async function animarFasesCarregamento() {
    const textEl = document.getElementById('loading-text');
    const loadingScreen = document.getElementById('myth-loading');
    const fases = [
        "A calcular o baricentro estelar...",
        "A avaliar o índice de alongamento da estrutura...",
        "A medir o coeficiente de assimetria...",
        "A mapear ciclos na rede topológica...",
        "A invocar o motor semântico..."
    ];
    textEl.classList.remove('visible');
    for (let fase of fases) {
        if (loadingScreen.style.display === 'none') break;
        textEl.innerText = fase;
        textEl.classList.add('visible');
        await new Promise(resolve => setTimeout(resolve, 1400));
        if (loadingScreen.style.display === 'none') break;
        textEl.classList.remove('visible');
        await new Promise(resolve => setTimeout(resolve, 400));
    }
}

window.onForgeConstellation = async function() {
    if (tempLine) { scene.remove(tempLine); tempLine = null; }

    if (userSelectedStars.length < 2) {
        if (typeof window.mostrarNotificacao === 'function') window.mostrarNotificacao("Liga pelo menos 2 estrelas para forjar.");
        return;
    }
    clearAllLines();
    const forgeBtn = document.getElementById('forge-btn');
    const mythLoading = document.getElementById('myth-loading');
    const mythContent = document.getElementById('myth-content');
    const sidebar = document.getElementById('interface-myth');
    forgeBtn.disabled = true; forgeBtn.innerText = 'A FORJAR...'; forgeBtn.style.opacity = '0.6';
    mythContent.style.display = 'none'; mythLoading.style.display = 'flex'; sidebar.classList.add('visible');
    const animacaoPromise = animarFasesCarregamento();
    try {
        const payload = { skeleton_stars: userSelectedStars, edges: userCreatedEdges };
        const responseCompleta = await fetch('http://127.0.0.1:5000/api/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await responseCompleta.json();
        aiCreatedEdges = result.ai_edges || [];
        userCreatedEdges.forEach(edge => { drawVisualLine(userSelectedStars.find(s=>s.id===edge.from).coords, userSelectedStars.find(s=>s.id===edge.to).coords, 0xc9a84c); });
        aiCreatedEdges.forEach(edge => {
            const f = starsGroup.children.find(s => s.userData.id === edge.from);
            const t = starsGroup.children.find(s => s.userData.id === edge.to);
            if (f && t) drawVisualLine(f.position, t.position, 0xa8c4e0);
        });
        userSelectedStars.forEach(s => { const starObj = starsGroup.children.find(o => o.userData.id === s.id); if (starObj) starObj.material.color.setHex(0xc9a84c); });
        activeStar = null;
        const responseMyth = await fetch('http://127.0.0.1:5000/api/myth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ constellation_name: "Nova Constelação", star_names: userSelectedStars.map(s => s.name), stars: userSelectedStars.map(s => ({ name: s.name, con: s.con })), properties: result.properties }) });
        const myth = await responseMyth.json();
        currentMythData = myth;
        currentMythData.properties = result.properties;
        await animacaoPromise;
        displayMythAndMetadata(myth.titulo, myth.texto, myth.is_real, myth.is_real ? `Constelação Real: ${myth.real_name}` : `Constelação Criada: ${myth.real_name}`, result.properties);
        document.getElementById('save-btn').disabled = false;
        if (userSelectedStars.length > 0) {
            const centroid = new THREE.Vector3();
            userSelectedStars.forEach(s => centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z)));
            centroid.divideScalar(userSelectedStars.length);
            targetCameraPosition = centroid.clone().normalize().multiplyScalar(-camera.position.length());
            isCentering = true;
        }
    } catch (err) { console.error(err); sidebar.classList.remove('visible'); } finally { forgeBtn.disabled = false; forgeBtn.innerText = 'GERAR MITO'; forgeBtn.style.opacity = '1'; }
}

window.closeMythSidebar = function() { document.getElementById('interface-myth').classList.remove('visible'); };
controls.addEventListener('start', () => { isCentering = false; });

function displayMythAndMetadata(mythTitle, mythText, isReal, badgeText, properties) {
    const badge = document.getElementById('myth-badge');
    badge.innerText = badgeText;
    badge.className = isReal ? 'badge-real' : 'badge-custom';
    badge.style.display = 'inline-block';
    document.getElementById('myth-title').innerText = mythTitle || "Mito Celestial";
    const textDiv = document.getElementById('myth-text');
    textDiv.innerHTML = '';
    if (mythText) { mythText.split(/\n+/).forEach(pText => { if (pText.trim()) { const p = document.createElement('p'); p.innerText = pText.trim(); textDiv.appendChild(p); } }); }
    const metaDiv = document.getElementById('myth-metadata');
    metaDiv.innerHTML = '';
    if (properties) {
        let h = `<p><strong>Visibilidade:</strong> ${properties.epoca_visibilidade || 'N/A'}.</p>`;
        h += `<p><strong>Arquétipos:</strong> ${properties.silhueta_ancestral || 'N/A'}.</p>`;
        metaDiv.innerHTML = h;
    }
    document.getElementById('myth-loading').style.display = 'none';
    document.getElementById('myth-content').style.display = 'block';
}

function clearAllLines() {
    if (tempLine) scene.remove(tempLine);
    while (linesGroup.children.length > 0) {
        const line = linesGroup.children[0];
        linesGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }
}

window.onClearSky = function() {
    clearAllLines();
    userSelectedStars.forEach(s => { const starObj = starsGroup.children.find(o => o.userData.id === s.id); if (starObj) starObj.material.color.setHex(0xffffff); });
    userSelectedStars = []; userCreatedEdges = []; activeStar = null; isCentering = false; targetCameraPosition = null; currentMythData = null;
    document.getElementById('star-count').innerText = '0'; document.getElementById('save-btn').disabled = true; window.closeMythSidebar();
};

window.onSaveConstellation = async function() {
    if (!currentMythData || userSelectedStars.length === 0) return;
    const constName = await window.mostrarModalCustom('prompt', "Nome da tua Constelação:", currentMythData.real_name || "Nova");
    if (!constName) return;
    const saved = { id: Date.now(), name: constName, myth_title: currentMythData.titulo, myth_text: currentMythData.texto, myth_is_real: currentMythData.is_real, skeleton_stars: userSelectedStars, user_edges: userCreatedEdges, ai_edges: aiCreatedEdges, properties: currentMythData.properties };
    let lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    lib.push(saved);
    localStorage.setItem('saved_constellations', JSON.stringify(lib));
    if (typeof window.mostrarNotificacao === 'function') window.mostrarNotificacao(`Constelação "${constName}" guardada.`);
    renderLibrary();
};

window.onDeleteConstellation = async function(id) {
    if (!(await window.mostrarModalCustom('confirm', "Apagar esta constelação?"))) return;
    let lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    lib = lib.filter(i => i.id !== id);
    localStorage.setItem('saved_constellations', JSON.stringify(lib));
    renderLibrary();
};

window.loadConstellation = function(id) {
    const lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    const saved = lib.find(i => i.id === id);
    if (!saved) return;
    window.onClearSky();
    userSelectedStars = saved.skeleton_stars;
    userCreatedEdges = saved.user_edges;
    aiCreatedEdges = saved.ai_edges;
    userSelectedStars.forEach(s => { const so = starsGroup.children.find(o => o.userData.id === s.id); if (so) so.material.color.setHex(0xc9a84c); });
    userCreatedEdges.forEach(e => drawVisualLine(userSelectedStars.find(s=>s.id===e.from).coords, userSelectedStars.find(s=>s.id===e.to).coords, 0xc9a84c));
    aiCreatedEdges.forEach(e => {
        const f = starsGroup.children.find(s => s.userData.id === e.from);
        const t = starsGroup.children.find(s => s.userData.id === e.to);
        if (f && t) drawVisualLine(f.position, t.position, 0xa8c4e0);
    });
    displayMythAndMetadata(saved.myth_title, saved.myth_text, saved.myth_is_real, saved.name, saved.properties);
    document.getElementById('interface-myth').classList.add('visible');
    document.getElementById('star-count').innerText = userSelectedStars.length;
    currentMythData = { real_name: saved.name, titulo: saved.myth_title, texto: saved.myth_text, is_real: saved.myth_is_real, properties: saved.properties };
    document.getElementById('save-btn').disabled = false;
    if (userSelectedStars.length > 0) {
        const centroid = new THREE.Vector3();
        userSelectedStars.forEach(s => centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z)));
        centroid.divideScalar(userSelectedStars.length);
        targetCameraPosition = centroid.clone().normalize().multiplyScalar(-camera.position.length());
        isCentering = true;
    }
};

function renderLibrary() {
    const listEl = document.getElementById('library-list');
    if (!listEl) return;
    const lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    listEl.innerHTML = lib.length === 0 ? '<div class="library-empty">Sem constelações.</div>' : '';
    lib.forEach(item => {
        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `<span class="library-item-name" onclick="loadConstellation(${item.id})">${item.name}</span><button class="library-item-delete" onclick="onDeleteConstellation(${item.id})">&times;</button>`;
        listEl.appendChild(div);
    });
}
renderLibrary();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
    requestAnimationFrame(animate);
    if (isCentering && targetCameraPosition) {
        camera.position.lerp(targetCameraPosition, 0.05);
        if (camera.position.distanceTo(targetCameraPosition) < 0.001) { camera.position.copy(targetCameraPosition); isCentering = false; }
    }
    controls.update();

    const compassNeedle = document.getElementById('compass-needle');
    if (compassNeedle) {
        const azimuth = controls.getAzimuthalAngle();

        compassNeedle.style.transform = `rotate(${-azimuth}rad)`;
    }

    renderer.render(scene, camera);
}
animate();