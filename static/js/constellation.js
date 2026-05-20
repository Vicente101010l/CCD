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
let userSelectedStars = [];
let userCreatedEdges = [];
let tempLine = null;
const starsGroup = new THREE.Group();
scene.add(starsGroup);

// --- CRIAR CÉU ESFÉRICO ---
const starRadius = 50;
for (let i = 0; i < 97; i++) {
    const geometry = new THREE.SphereGeometry(0.15, 12, 12);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const star = new THREE.Mesh(geometry, material);

    // Distribuição esférica uniforme
    const phi = Math.acos(1 - 2 * Math.random());
    const theta = 2 * Math.PI * Math.random();
    star.position.set(
        starRadius * Math.sin(phi) * Math.cos(theta),
        starRadius * Math.sin(phi) * Math.sin(theta),
        starRadius * Math.cos(phi)
    );

    star.userData = { id: i, name: `Estrela ${i}` };
    starsGroup.add(star);
}

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
            coords: { x: clickedStar.position.x, y: clickedStar.position.y, z: clickedStar.position.z }
        });
    }
});

// LINHA ELÁSTICA (RUBBER-BANDING)
window.addEventListener('mousemove', (event) => {
    if (userSelectedStars.length === 0) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
            properties: result.properties
        })
    });

    const myth = await mythRes.json();
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