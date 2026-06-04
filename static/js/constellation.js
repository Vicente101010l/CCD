import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURAÇÃO CENA ---
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

// --- NAVEGAÇÃO ESTILO PLANETÁRIO ---
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 0, 0.1); 
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableZoom = true;
controls.rotateSpeed = -0.3; 
controls.minDistance = 0.1;
controls.maxDistance = 8.0;

// --- GERADOR DE TEXTURA DE ESTRELA ORGÂNICA ---
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

// --- ADICIONA ESTRELAS DE FUNDO ---
function createCosmicDust() {
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 6000; // Mantido em 6000 para densidade premium em monitores grandes
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
    
    // CORREÇÃO DE CORPO: 
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

// --- ZOOM SLIDER INTEGRATION ---
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

// --- ESTADO ---
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

// --- CRIAR CÉU ESFÉRICO REAL ---
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
                color: starData.color
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
    if (event.target !== renderer.domElement) {
        return;
    }

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

// TOOLTIP E LINHA ELÁSTICA 
const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (event) => {
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
        tooltip.innerText = `${hoveredStar.userData.name} (Mag: ${hoveredStar.userData.mag}, ${hoveredStar.userData.con})`;
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
        tooltip.style.display = 'block';
        document.body.style.cursor = 'pointer';
    } else {
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
        if (starObj) {
            starObj.material.color.setHex(0xc9a84c); 
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
            deselectActiveStar();
        } else {
            userCreatedEdges.push({ from: activeStar.id, to: starData.id });
            drawVisualLine(activeStar.coords, starData.coords, 0xc9a84c);

            if (!alreadySelected) {
                userSelectedStars.push(starData);
                document.getElementById('star-count').innerText = userSelectedStars.length;
            }

            const prevActiveStarObj = starsGroup.children.find(s => s.userData.id === activeStar.id);
            if (prevActiveStarObj) {
                prevActiveStarObj.material.color.setHex(0xc9a84c);
            }

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
        opacity: 0.45,
        linewidth: 1
    });
    const points = [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    linesGroup.add(line);
}

window.onForgeConstellation = async function() {
    if (userSelectedStars.length < 2) {
        alert("Por favor, liga pelo menos 2 estrelas para gerar uma constelação!");
        return;
    }
    clearAllLines();

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

    try {
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        camera.updateMatrixWorld();
        projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        const visibleIds = [];
        starsGroup.children.forEach(star => {
            if (frustum.containsPoint(star.position)) {
                visibleIds.push(star.userData.id);
            }
        });

        const payload = { 
            skeleton_stars: userSelectedStars, 
            edges: userCreatedEdges,
            visible_stars: visibleIds 
        };

        const response = await fetch('http://127.0.0.1:5000/api/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        aiCreatedEdges = result.ai_edges || [];

        userCreatedEdges.forEach(edge => {
            const startStar = userSelectedStars.find(s => s.id === edge.from);
            const endStar = userSelectedStars.find(s => s.id === edge.to);
            if (startStar && endStar) {
                drawVisualLine(startStar.coords, endStar.coords, 0xc9a84c);
            }
        });

        aiCreatedEdges.forEach(edge => {
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

        userSelectedStars.forEach(s => {
            const starObj = starsGroup.children.find(o => o.userData.id === s.id);
            if (starObj) {
                starObj.material.color.setHex(0xc9a84c);
            }
        });
        activeStar = null;

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
        currentMythData = myth;
        currentMythData.properties = result.properties;
        
        displayMythAndMetadata(
            myth.titulo,
            myth.texto,
            myth.is_real,
            myth.is_real ? `Constelação Real: ${myth.real_name}` : `Constelação Criada: ${myth.real_name}`,
            result.properties
        );

        document.getElementById('save-btn').disabled = false;

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
    } finally {
        forgeBtn.disabled = false;
        forgeBtn.innerText = 'GERAR MITO';
        forgeBtn.style.opacity = '1';
    }
}

window.closeMythSidebar = function() {
    document.getElementById('interface-myth').classList.remove('visible');
};

controls.addEventListener('start', () => {
    isCentering = false;
});

// --- BIBLIOTECA E ACÇÕES ---
function displayMythAndMetadata(mythTitle, mythText, isReal, badgeText, properties) {
    const badge = document.getElementById('myth-badge');
    badge.innerText = badgeText;
    badge.className = isReal ? 'badge-real' : 'badge-custom';
    badge.style.display = 'inline-block';

    document.getElementById('myth-title').innerText = mythTitle || "Mito Celestial";

    const textDiv = document.getElementById('myth-text');
    textDiv.innerHTML = '';
    if (mythText) {
        const paragraphs = mythText.split(/\n+/);
        paragraphs.forEach(pText => {
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
        let metadataHTML = '';
        const epoca = properties.epoca_visibilidade || 'Estação Indefinida';
        const zona = properties.zona_cosmica || 'Zona Indefinida';
        const proximidade = properties.via_lactea_proximidade || 'Relação Indefinida';
        metadataHTML += `<p><strong>Visibilidade Celestial:</strong> Esta silhueta emerge predominantemente durante as noites de <em>${epoca}</em>, posicionando-se na <em>${zona}</em> do firmamento. É uma <em>${proximidade}</em>.</p>`;

        const elong = properties.elongation ? properties.elongation.toFixed(2) : '1.00';
        const asym = properties.asymmetry ? properties.asymmetry.toFixed(2) : '0.00';
        const hasCyclesStr = properties.has_cycles ? 'contem ciclos fechados (ligações em anel)' : 'forma uma estrutura de árvore aberta e ramificada';
        metadataHTML += `<p><strong>Métricas do Esqueleto:</strong> O traçado reveals um índice de alongamento de <strong>${elong}</strong> e um coeficiente de assimetria de <strong>${asym}</strong> em relação ao baricentro estelar. A rede <strong>${hasCyclesStr}</strong>.</p>`;

        const silhueta = properties.silhueta_ancestral || 'Forma Indefinida';
        const temperamento = properties.temperamento_elemental || 'Elemento Indefinido';
        const estatuto = properties.estatuto_divino || 'Estatuto Indefinido';

        metadataHTML += `<p><strong>Arquétipos do Firmamento:</strong></p><ul>`;
        metadataHTML += `<li><strong>Silhueta Ancestral:</strong> Mapeada sob o arquétipo de <em>${silhueta}</em>.</li>`;
        metadataHTML += `<li><strong>Temperamento Elemental:</strong> Resonância baseada espectralmente em energia <em>${temperamento}</em>.</li>`;
        metadataHTML += `<li><strong>Estatuto de Nobreza:</strong> Classificada no patamar <em>${estatuto}</em>.</li></ul>`;

        metaDiv.innerHTML = metadataHTML;
    }

    document.getElementById('myth-loading').style.display = 'none';
    document.getElementById('myth-content').style.display = 'block';
}

function clearAllLines() {
    if (tempLine) {
        scene.remove(tempLine);
        tempLine = null;
    }
    while (linesGroup.children.length > 0) {
        const line = linesGroup.children[0];
        linesGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }
}

window.onClearSky = function() {
    clearAllLines();
    userSelectedStars.forEach(s => {
        const starObj = starsGroup.children.find(o => o.userData.id === s.id);
        if (starObj) {
            starObj.material.color.setHex(0xffffff); 
        }
    });

    userSelectedStars = [];
    userCreatedEdges = [];
    aiCreatedEdges = [];
    activeStar = null;
    isCentering = false;
    targetCameraPosition = null;
    currentMythData = null;

    document.getElementById('star-count').innerText = '0';
    document.getElementById('save-btn').disabled = true;
    window.closeMythSidebar();
};

window.onSaveConstellation = function() {
    if (!currentMythData || userSelectedStars.length === 0) return;

    const defaultName = currentMythData.real_name || currentMythData.nome_constelacao || "Nova Constelação";
    const constName = prompt("Nome da tua Constelação:", defaultName);
    if (!constName) return;

    const savedItem = {
        id: Date.now(),
        name: constName,
        myth_title: currentMythData.titulo,
        myth_text: currentMythData.texto,
        myth_is_real: currentMythData.is_real,
        skeleton_stars: userSelectedStars,
        user_edges: userCreatedEdges,
        ai_edges: aiCreatedEdges,
        properties: currentMythData.properties
    };

    let library = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    library.push(savedItem);
    localStorage.setItem('saved_constellations', JSON.stringify(library));

    alert(`A constelação "${constName}" foi guardada na tua Biblioteca!`);
    renderLibrary();
};

window.onDeleteConstellation = function(id) {
    if (!confirm("Tens a certeza que queres apagar esta constelação da biblioteca?")) return;
    let library = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    library = library.filter(item => item.id !== id);
    localStorage.setItem('saved_constellations', JSON.stringify(library));
    renderLibrary();
};

window.loadConstellation = function(id) {
    let library = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    const saved = library.find(item => item.id === id);
    if (!saved) return;

    window.onClearSky();

    userSelectedStars = saved.skeleton_stars;
    userCreatedEdges = saved.user_edges;
    aiCreatedEdges = saved.ai_edges;

    userSelectedStars.forEach(s => {
        const starObj = starsGroup.children.find(o => o.userData.id === s.id);
        if (starObj) {
            starObj.material.color.setHex(0xc9a84c);
        }
    });

    userCreatedEdges.forEach(edge => {
        const startStar = userSelectedStars.find(s => s.id === edge.from);
        const endStar = userSelectedStars.find(s => s.id === edge.to);
        if (startStar && endStar) {
            drawVisualLine(startStar.coords, endStar.coords, 0xc9a84c);
        }
    });

    aiCreatedEdges.forEach(edge => {
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

    displayMythAndMetadata(
        saved.myth_title,
        saved.myth_text,
        saved.myth_is_real,
        saved.myth_is_real ? `Constelação Real: ${saved.name}` : `Constelação Criada: ${saved.name}`,
        saved.properties
    );
    document.getElementById('interface-myth').classList.add('visible');
    document.getElementById('star-count').innerText = userSelectedStars.length;

    currentMythData = {
        real_name: saved.name,
        titulo: saved.myth_title,
        texto: saved.myth_text,
        is_real: saved.myth_is_real,
        properties: saved.properties
    };
    document.getElementById('save-btn').disabled = false;

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
};

function renderLibrary() {
    const listEl = document.getElementById('library-list');
    if (!listEl) return;

    const library = JSON.parse(localStorage.getItem('saved_constellations') || '[]');
    listEl.innerHTML = '';

    if (library.length === 0) {
        listEl.innerHTML = '<div class="library-empty">Sem constelações na biblioteca.</div>';
        return;
    }

    library.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'library-item';
        itemEl.innerHTML = `
            <span class="library-item-name" onclick="loadConstellation(${item.id})">${item.name}</span>
            <button class="library-item-delete" onclick="onDeleteConstellation(${item.id})">&times;</button>
        `;
        listEl.appendChild(itemEl);
    });
}
renderLibrary();

// --- CORREÇÃO DE RESOLUÇÃO DINÂMICA (ESCUTA O REDIMENSIONAMENTO) ---
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
        if (camera.position.distanceTo(targetCameraPosition) < 0.001) {
            camera.position.copy(targetCameraPosition);
            isCentering = false;
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}
animate();