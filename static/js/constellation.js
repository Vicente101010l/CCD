import * as THREE from 'three';
import { 
    scene, 
    camera, 
    renderer, 
    controls, 
    starRadius, 
    centerCameraOn, 
    stopCentering, 
    updateCameraCentering 
} from './modules/three-scene.js';
import { 
    starsGroup, 
    loadStars, 
    updateStarLabels, 
    updateCompass 
} from './modules/stars.js';
import { 
    completeConstellation, 
    generateMyth 
} from './modules/api.js';
import { 
    playChime, 
    playUi 
} from './modules/audio.js';
import { 
    mostrarNotificacao, 
    mostrarModalCustom, 
    desenrolarPergaminho, 
    animarFasesCarregamento 
} from './modules/ui.js';

let isolatedConstellationId = null;
let userSelectedStars = [];
let userCreatedEdges = [];
let aiCreatedEdges = [];
let tempLine = null;
let activeStar = null;
let currentMythData = null;
let drawingHistory = [];
let constellationLabels = []; 
let currentLoadedConstellationId = null; 
let currentMode = 'create';

const linesGroup = new THREE.Group();
const guidesGroup = new THREE.Group();
const savedLinesGroup = new THREE.Group(); 
scene.add(starsGroup, linesGroup, guidesGroup, savedLinesGroup);

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

loadStars(() => {
    renderSavedConstellations();
});

export function setMode(mode) {
    currentMode = mode;
    
    document.getElementById('mode-create').classList.toggle('active', mode === 'create');
    document.getElementById('mode-library').classList.toggle('active', mode === 'library');

    const controlsPanel = document.getElementById('controls-panel');
    const onboardingMsg = document.getElementById('onboarding-msg');

    if (mode === 'library') {
        if (controlsPanel) controlsPanel.style.display = 'none';
        if (onboardingMsg) onboardingMsg.style.display = 'none';
        
        savedLinesGroup.visible = true;
        linesGroup.visible = false;
        guidesGroup.visible = false;

        document.getElementById('save-btn-floating').style.display = 'none';
        document.getElementById('delete-btn-floating').style.display = 'none';
    } else {
        if (controlsPanel) controlsPanel.style.display = 'flex'; 
        if (onboardingMsg) onboardingMsg.style.display = 'block';
        
        savedLinesGroup.visible = false;
        linesGroup.visible = true;
        guidesGroup.visible = true;
    }
    
    renderSavedConstellations();
}
window.setMode = setMode;

export function renderSavedConstellations() {
    for (let i = savedLinesGroup.children.length - 1; i >= 0; i--) {
        const child = savedLinesGroup.children[i];
        savedLinesGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    constellationLabels.forEach(obj => {
        if(obj.element && obj.element.parentNode) obj.element.parentNode.removeChild(obj.element);
    });
    constellationLabels = [];

    const lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    
    lib.forEach(constellation => {
        let centroid = new THREE.Vector3();
        let starCount = 0;

        constellation.skeleton_stars.forEach(s => {
            centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z));
            starCount++;
        });

        (constellation.user_edges || []).forEach(edge => {
            const fromStar = starsGroup.children.find(s => String(s.userData.id) === String(edge.from));
            const toStar = starsGroup.children.find(s => String(s.userData.id) === String(edge.to));
            if(fromStar && toStar) {
                const material = new THREE.LineBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.7 }); 
                const points = [fromStar.position.clone(), toStar.position.clone()];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, material);
                line.userData.constellationId = String(constellation.id);
                savedLinesGroup.add(line);
            }
        });

        (constellation.ai_edges || []).forEach(edge => {
            const fromStar = starsGroup.children.find(s => String(s.userData.id) === String(edge.from));
            const toStar = starsGroup.children.find(s => String(s.userData.id) === String(edge.to));
            if(fromStar && toStar) {
                const material = new THREE.LineBasicMaterial({ color: 0xa8c4e0, transparent: true, opacity: 0.7 }); 
                const points = [fromStar.position.clone(), toStar.position.clone()];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, material);
                line.userData.constellationId = String(constellation.id);
                savedLinesGroup.add(line);
            }
        });

        if (starCount > 0) {
            centroid.divideScalar(starCount);
            const label = document.createElement('div');
            label.className = 'constellation-label-fixed';
            label.innerText = constellation.name;
            
            label.onclick = () => {
                if (currentMode === 'library') {
                    loadConstellation(constellation.id);
                }
            };
            
            document.body.appendChild(label);
            constellationLabels.push({ element: label, position: centroid, id: String(constellation.id) });
        }
    });

    savedLinesGroup.visible = (currentMode === 'library');
}

function saveHistoryState() {
    drawingHistory.push({
        userSelectedStars: JSON.parse(JSON.stringify(userSelectedStars)),
        userCreatedEdges: JSON.parse(JSON.stringify(userCreatedEdges)),
        activeStar: activeStar ? JSON.parse(JSON.stringify(activeStar)) : null
    });
    if (drawingHistory.length > 50) drawingHistory.shift();
    updateUndoButtonState();
}

function updateUndoButtonState() {
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.disabled = drawingHistory.length === 0;
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (currentMode === 'library') return; 
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
            mag: clickedStar.userData.mag,
            color: clickedStar.userData.color
        });
    } else {
        deselectActiveStar();
    }
});

const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', throttle((event) => {
    if (currentMode === 'library') return; 
    
    const forgeBtn = document.getElementById('forge-btn');
    if (forgeBtn && forgeBtn.disabled) return;

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
}, 20));

function deselectActiveStar() {
    if (activeStar) {
        saveHistoryState();
        const starObj = starsGroup.children.find(s => String(s.userData.id) === String(activeStar.id));
        if (starObj) starObj.material.color.setHex(0xc9a84c); 
        activeStar = null;
        if (tempLine) { scene.remove(tempLine); tempLine = null; }
        clearProximityGuides();
    }
}

function cleanOrphanStars() {
    const activeIdsInEdges = new Set();
    userCreatedEdges.forEach(e => {
        activeIdsInEdges.add(String(e.from));
        activeIdsInEdges.add(String(e.to));
    });
    userSelectedStars = userSelectedStars.filter(s => 
        activeIdsInEdges.has(String(s.id)) || (activeStar && String(s.id) === String(activeStar.id))
    );
    document.getElementById('star-count').innerText = userSelectedStars.length;
}

function drawVisualLineInstant(start, end, colorHex) {
    const material = new THREE.LineBasicMaterial({ 
        color: colorHex, 
        transparent: true, 
        opacity: 0.8 
    });
    const points = [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    linesGroup.add(line);
}

function redrawCurrentConstellation() {
    clearAllLines();
    
    starsGroup.children.forEach(starObj => {
        starObj.material.color.set(starObj.userData.color || "#ffffff");
    });
    
    userSelectedStars.forEach(s => {
        const starObj = starsGroup.children.find(o => String(o.userData.id) === String(s.id));
        if (starObj) starObj.material.color.setHex(0xc9a84c);
    });
    
    if (activeStar) {
        const starObj = starsGroup.children.find(o => String(o.userData.id) === String(activeStar.id));
        if (starObj) starObj.material.color.setHex(0x00ffff);
    }
    
    userCreatedEdges.forEach(edge => {
        const startStar = userSelectedStars.find(s => String(s.id) === String(edge.from));
        const endStar = userSelectedStars.find(s => String(s.id) === String(edge.to));
        if (startStar && endStar) {
            drawVisualLineInstant(startStar.coords, endStar.coords, 0xc9a84c);
        }
    });

    aiCreatedEdges.forEach(edge => {
        const f = starsGroup.children.find(s => String(s.userData.id) === String(edge.from));
        const t = starsGroup.children.find(s => String(s.userData.id) === String(edge.to));
        if (f && t) {
            drawVisualLineInstant(f.position, t.position, 0xa8c4e0);
        }
    });
}

function drawProximityGuides(activeStarData) {
    clearProximityGuides();
    if (!activeStarData) return;
    
    const activeCoords = new THREE.Vector3(activeStarData.coords.x, activeStarData.coords.y, activeStarData.coords.z);
    
    starsGroup.children.forEach(star => {
        if (String(star.userData.id) === String(activeStarData.id)) return;
        
        const dist = activeCoords.distanceTo(star.position);
        if (dist < 18.0) {
            const material = new THREE.LineDashedMaterial({ 
                color: 0xc9a84c, 
                dashSize: 0.5, 
                gapSize: 0.5, 
                transparent: true, 
                opacity: 0.20 
            });
            const points = [activeCoords, star.position.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances();
            guidesGroup.add(line);
        }
    });
}

function clearProximityGuides() {
    while (guidesGroup.children.length > 0) {
        const line = guidesGroup.children[0];
        guidesGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }
}

export function onUndo() {
    if (drawingHistory.length === 0) {
        mostrarNotificacao("Nada para desfazer.");
        return;
    }
    
    const previousState = drawingHistory.pop();
    
    userSelectedStars = previousState.userSelectedStars;
    userCreatedEdges = previousState.userCreatedEdges;
    activeStar = previousState.activeStar;
    aiCreatedEdges = []; 
    
    redrawCurrentConstellation();
    drawProximityGuides(activeStar);
    updateUndoButtonState();
    
    document.getElementById('save-btn-floating').style.display = 'none';
    document.getElementById('star-count').innerText = userSelectedStars.length;
    
    mostrarNotificacao("Última ação desfeita.");
}
window.onUndo = onUndo;

export function onStarClick(starData) {
    const onboarding = document.getElementById('onboarding-msg');
    if (onboarding) { onboarding.style.display = 'none'; onboarding.remove(); }
    
    playChime();

    const starObj = starsGroup.children.find(s => String(s.userData.id) === String(starData.id));
    if (!starObj) return;

    const alreadySelected = userSelectedStars.find(s => String(s.id) === String(starData.id));

    if (activeStar) {
        if (String(activeStar.id) === String(starData.id)) { 
            deselectActiveStar(); 
        } 
        else {
            const edgeIdx = userCreatedEdges.findIndex(e => 
                (String(e.from) === String(activeStar.id) && String(e.to) === String(starData.id)) ||
                (String(e.from) === String(starData.id) && String(e.to) === String(activeStar.id))
            );
            
            saveHistoryState();
            
            if (edgeIdx !== -1) {
                userCreatedEdges.splice(edgeIdx, 1);
                cleanOrphanStars();
                redrawCurrentConstellation();
                mostrarNotificacao("Ligação removida.");
            } else {
                userCreatedEdges.push({ from: activeStar.id, to: starData.id });
                drawVisualLineInstant(activeStar.coords, starData.coords, 0xc9a84c);
                if (!alreadySelected) {
                    userSelectedStars.push(starData);
                }
                const prevActiveStarObj = starsGroup.children.find(s => String(s.userData.id) === String(activeStar.id));
                if (prevActiveStarObj) prevActiveStarObj.material.color.setHex(0xc9a84c);
                activeStar = starData;
                starObj.material.color.setHex(0x00ffff);
                document.getElementById('star-count').innerText = userSelectedStars.length;
            }
            drawProximityGuides(activeStar);
        }
    } else {
        saveHistoryState();
        if (!alreadySelected) {
            userSelectedStars.push(starData);
            document.getElementById('star-count').innerText = userSelectedStars.length;
        }
        activeStar = starData;
        starObj.material.color.setHex(0x00ffff);
        drawProximityGuides(activeStar);
    }
}

export async function onForgeConstellation() {
    if (tempLine) { scene.remove(tempLine); tempLine = null; }

    if (userSelectedStars.length < 2) {
        mostrarNotificacao("Liga pelo menos 2 estrelas para forjar.");
        return;
    }
    clearAllLines();
    
    const frustum = new THREE.Frustum();
    const cameraViewProjectionMatrix = new THREE.Matrix4();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);
    
    const visibleStars = [];
    starsGroup.children.forEach(star => {
        if (frustum.containsPoint(star.position)) visibleStars.push(star.userData.id);
    });

    const forgeBtn = document.getElementById('forge-btn');
    const mythLoading = document.getElementById('myth-loading');
    const mythContent = document.getElementById('myth-content');
    const sidebar = document.getElementById('interface-myth');
    
    forgeBtn.disabled = true; 
    forgeBtn.innerText = 'A GERAR...'; 
    forgeBtn.style.opacity = '0.6';
    mythContent.style.display = 'none'; 
    mythLoading.style.display = 'flex'; 
    sidebar.classList.add('visible');

    controls.enableZoom = false;

    const animacaoPromise = animarFasesCarregamento(
        document.getElementById('loading-text'),
        mythLoading
    );
    
    try {
        const payload = { 
            skeleton_stars: userSelectedStars, 
            edges: userCreatedEdges, 
            visible_stars: visibleStars 
        };
        
        const result = await completeConstellation(payload);
        aiCreatedEdges = result.ai_edges || [];
        
        userCreatedEdges.forEach(edge => { 
            drawVisualLineInstant(
                userSelectedStars.find(s=>String(s.id)===String(edge.from)).coords, 
                userSelectedStars.find(s=>String(s.id)===String(edge.to)).coords, 
                0xc9a84c
            ); 
        });
        
        aiCreatedEdges.forEach(edge => {
            const f = starsGroup.children.find(s => String(s.userData.id) === String(edge.from));
            const t = starsGroup.children.find(s => String(s.userData.id) === String(edge.to));
            if (f && t) drawVisualLineInstant(f.position, t.position, 0xa8c4e0);
        });
        
        userSelectedStars.forEach(s => { 
            const starObj = starsGroup.children.find(o => String(o.userData.id) === String(s.id)); 
            if (starObj) starObj.material.color.setHex(0xc9a84c); 
        });
        activeStar = null;
        
        const responseMyth = await generateMyth({ 
            constellation_name: "Nova Constelação", 
            star_names: userSelectedStars.map(s => s.name), 
            stars: userSelectedStars.map(s => ({ name: s.name, con: s.con, mag: s.mag, color: s.color })), 
            properties: result.properties 
        });
        
        currentMythData = responseMyth;
        currentMythData.properties = result.properties;
        await animacaoPromise;
        
        displayMythAndMetadata(
            responseMyth.titulo, 
            responseMyth.texto, 
            responseMyth.is_real, 
            responseMyth.is_real ? `Constelação Real: ${responseMyth.real_name}` : `Constelação Criada: ${responseMyth.real_name}`, 
            result.properties
        );
        
        document.getElementById('save-btn-floating').style.display = 'block';
        
        if (userSelectedStars.length > 0) {
            const centroid = new THREE.Vector3();
            userSelectedStars.forEach(s => centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z)));
            centroid.divideScalar(userSelectedStars.length);
            
            centerCameraOn(centroid);
        }
    } catch (err) { 
        console.error("Erro ao forjar constelação:", err); 
        sidebar.classList.remove('visible'); 
        controls.enableZoom = true; 
    } finally { 
        forgeBtn.disabled = false; 
        forgeBtn.innerText = 'GERAR MITO'; 
        forgeBtn.style.opacity = '1'; 
    }
}
window.onForgeConstellation = onForgeConstellation;

export function closeMythSidebar() { 
    document.getElementById('interface-myth').classList.remove('visible'); 
    isolatedConstellationId = null;
    
    controls.enableZoom = true; 
    savedLinesGroup.children.forEach(line => line.visible = true);
    constellationLabels.forEach(lbl => lbl.element.style.display = 'block');
    
    const delBtn = document.getElementById('delete-btn-floating');
    if (delBtn) delBtn.style.display = 'none';
    
    stopCentering();
}
window.closeMythSidebar = closeMythSidebar;

function displayMythAndMetadata(mythTitle, mythText, isReal, badgeText, properties) {
    const badge = document.getElementById('myth-badge');
    badge.innerText = badgeText;
    badge.className = isReal ? 'badge-real' : 'badge-custom';
    badge.style.display = 'inline-block';
    
    document.getElementById('myth-title').innerText = mythTitle || "Mito Celestial";
    
    const textDiv = document.getElementById('myth-text');
    textDiv.innerHTML = '';
    if (mythText) { 
        mythText.split(/\n+/).forEach(pText => { 
            if (pText.trim()) { 
                const p = document.createElement('p'); 
                p.innerText = pText.trim(); 
                textDiv.appendChild(p); 
            } 
        }); 
    }
    
    const metaDiv = document.getElementById('myth-metadata');
    metaDiv.innerHTML = '';
    if (properties) {
        let h = `<p><strong>Visibilidade:</strong> ${properties.epoca_visibilidade || 'N/A'}.</p>`;
        h += `<p><strong>Arquétipos:</strong> ${properties.silhueta_ancestral || 'N/A'}.</p>`;
        h += `<p><strong>Estrutura:</strong> ${properties.shapes_detected || 'N/A'}.</p>`;
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

export function onClearSky(bypassHistory = false) {
    if (!bypassHistory) { saveHistoryState(); }
    clearAllLines();
    clearProximityGuides();
    
    userSelectedStars.forEach(s => { 
        const starObj = starsGroup.children.find(o => String(o.userData.id) === String(s.id)); 
        if (starObj) starObj.material.color.set(starObj.userData.color || "#ffffff"); 
    });
    
    userSelectedStars = []; 
    userCreatedEdges = []; 
    activeStar = null; 
    currentMythData = null; 
    stopCentering();
    
    document.getElementById('star-count').innerText = '0'; 
    document.getElementById('save-btn-floating').style.display = 'none'; 
    document.getElementById('delete-btn-floating').style.display = 'none';
    closeMythSidebar();
    updateUndoButtonState();
}
window.onClearSky = onClearSky;

export function renderLibrary() {
    const listEl = document.getElementById('library-list');
    if (!listEl) return;
    
    const lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    listEl.innerHTML = '';
    
    if (lib.length === 0) {
        listEl.innerHTML = '<div class="library-empty">Sem constelações.</div>';
    } else {
        lib.forEach(item => {
            const div = document.createElement('div');
            div.className = 'library-item';
            
            const span = document.createElement('span');
            span.className = 'library-item-name';
            span.innerText = item.name;
            
            span.addEventListener('click', () => {
                loadConstellation(item.id);
            });
            
            div.appendChild(span);
            listEl.appendChild(div);
        });
    }
}
window.renderLibrary = renderLibrary;
renderLibrary();

export async function onSaveConstellation() {
    if (!currentMythData || userSelectedStars.length === 0) return;
    const constName = await mostrarModalCustom('prompt', "Nome da tua Constelação:", currentMythData.real_name || "Nova");
    if (!constName) return;

    const saved = { 
        id: Date.now(), 
        name: constName, 
        myth_title: currentMythData.titulo, 
        myth_text: currentMythData.texto, 
        myth_is_real: currentMythData.is_real, 
        skeleton_stars: JSON.parse(JSON.stringify(userSelectedStars)), 
        user_edges: JSON.parse(JSON.stringify(userCreatedEdges)), 
        ai_edges: JSON.parse(JSON.stringify(aiCreatedEdges)), 
        properties: currentMythData.properties 
    };
    
    let lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    lib.push(saved);
    localStorage.setItem('saved_constellations', JSON.stringify(lib));
    
    mostrarNotificacao(`Constelação "${constName}" guardada.`);
    
    document.getElementById('save-btn-floating').style.display = 'none';
    renderLibrary();
    renderSavedConstellations(); 
    onClearSky(true); 
    setMode('library'); 
}
window.onSaveConstellation = onSaveConstellation;

export function loadConstellation(id) {
    const lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    const saved = lib.find(i => String(i.id) === String(id));
    if (!saved) return;
    
    currentLoadedConstellationId = String(id);
    isolatedConstellationId = String(id);

    savedLinesGroup.children.forEach(line => {
        line.visible = (line.userData.constellationId === String(id));
    });
    constellationLabels.forEach(lbl => {
        lbl.element.style.display = (String(lbl.id) === String(id)) ? 'block' : 'none';
    });
    
    displayMythAndMetadata(saved.myth_title, saved.myth_text, saved.myth_is_real, saved.name, saved.properties);
    document.getElementById('delete-btn-floating').style.display = 'block'; 
    document.getElementById('interface-myth').classList.add('visible');
    
    controls.enableZoom = false; 
    
    if (saved.skeleton_stars.length > 0) {
        const centroid = new THREE.Vector3();
        saved.skeleton_stars.forEach(s => centroid.add(new THREE.Vector3(s.coords.x, s.coords.y, s.coords.z)));
        centroid.divideScalar(saved.skeleton_stars.length);
        
        centerCameraOn(centroid);
    }
}
window.loadConstellation = loadConstellation;

export async function onDeleteCurrentConstellation() {
    if (!currentLoadedConstellationId) return;
    if (!(await mostrarModalCustom('confirm', "Apagar permanentemente o mito?"))) return;
    
    let lib = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    lib = lib.filter(i => String(i.id) !== String(currentLoadedConstellationId));
    localStorage.setItem('saved_constellations', JSON.stringify(lib));
    
    closeMythSidebar();
    renderLibrary();
    renderSavedConstellations();
    document.getElementById('delete-btn-floating').style.display = 'none';
    
    mostrarNotificacao("Constelação removida.");
}
window.onDeleteCurrentConstellation = onDeleteCurrentConstellation;

function animate() {
    requestAnimationFrame(animate);
    
    updateCameraCentering();
    updateStarLabels();
    updateCompass();

    constellationLabels.forEach(lbl => {
        if (currentMode !== 'library') {
            lbl.element.style.display = 'none';
            return;
        }
        if (isolatedConstellationId !== null && String(lbl.id) !== String(isolatedConstellationId)) {
            lbl.element.style.display = 'none';
            return;
        }

        const v = lbl.position.clone().project(camera);
        if (v.z < 1) {
            const x = (v.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
            lbl.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            lbl.element.style.display = 'block';
        } else {
            lbl.element.style.display = 'none';
        }
    });

    renderer.render(scene, camera);
}
animate();

let isMouseDown = false;
let startX = 0;
let startY = 0;
const dragThreshold = 30; 

const canvas = document.querySelector('canvas'); 

canvas.addEventListener('mousedown', (e) => {
    if (document.getElementById('interface-myth').classList.contains('visible')) {
        isMouseDown = true;
        startX = e.clientX;
        startY = e.clientY;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown && document.getElementById('interface-myth').classList.contains('visible')) {
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            closeMythSidebar();
            isMouseDown = false; 
        }
    }
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});