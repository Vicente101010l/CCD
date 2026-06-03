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
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(starsGroup.children);

    if (intersects.length > 0) {
        const clickedStar = intersects[0].object;
        onStarClick({
            id: clickedStar.userData.id,
            name: clickedStar.userData.name,
            coords: { x: clickedStar.position.x, y: clickedStar.position.y, z: clickedStar.position.z },
            con: clickedStar.userData.con
        });
    }
});

// TOOLTIP E LINHA ELÁSTICA (MOUSEMOVE)
const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (event) => {
    // Atualizar coordenadas do rato para o raycaster
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // RAYCASTING PARA HOVER DE ESTRELAS
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(starsGroup.children);

    if (intersects.length > 0) {
        const hoveredStar = intersects[0].object;
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
    if (userSelectedStars.length === 0) return;

    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(starRadius));

    const lastStar = userSelectedStars[userSelectedStars.length - 1];

    if (tempLine) scene.remove(tempLine);
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lastStar.coords.x, lastStar.coords.y, lastStar.coords.z),
        pos
    ]);
    tempLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0xc9a84c, dashSize: 1, gapSize: 0.5 }));
    tempLine.computeLineDistances();
    scene.add(tempLine);
});

// --- LÓGICA DE NEGÓCIO ---
function onStarClick(starData) {
    const alreadySelected = userSelectedStars.find(s => s.id === starData.id);
    if (!alreadySelected) {
        if (userSelectedStars.length > 0) {
            const lastStar = userSelectedStars[userSelectedStars.length - 1];
            userCreatedEdges.push({ from: lastStar.id, to: starData.id });
            drawVisualLine(lastStar.coords, starData.coords, 0xc9a84c);
        }
        userSelectedStars.push(starData);
        const starObj = starsGroup.children.find(s => s.userData.id === starData.id);
        if (starObj) starObj.material.color.setHex(0xc9a84c);
        document.getElementById('star-count').innerText = userSelectedStars.length;
    }
}

function drawVisualLine(start, end, colorHex) {
    const material = new THREE.LineBasicMaterial({ color: colorHex });
    const points = [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    scene.add(new THREE.Line(geometry, material));
}

window.onForgeConstellation = async function() {
    if (userSelectedStars.length < 2) return;
    if (tempLine) scene.remove(tempLine);

    const payload = { skeleton_stars: userSelectedStars, edges: userCreatedEdges };
    const response = await fetch('http://127.0.0.1:5000/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    result.ai_edges.forEach(edge => {
        const fromStar = userSelectedStars.find(s => s.id === edge.from);
        const toStar = starsGroup.children.find(s => s.userData.id === edge.to);
        if (fromStar && toStar) {
            drawVisualLine(fromStar.coords, { x: toStar.position.x, y: toStar.position.y, z: toStar.position.z }, 0xa8c4e0);
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
    document.getElementById('interface-myth').classList.add('visible');
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();