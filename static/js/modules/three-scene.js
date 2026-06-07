import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 0, 0.1); 
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableZoom = true;
controls.rotateSpeed = -0.3;
controls.minDistance = 0.1;
controls.maxDistance = 8.0;

export const starRadius = 50;

let targetCameraPosition = null;
let isCentering = false;

export function centerCameraOn(centroid) {
    let dist = camera.position.length();
    if (dist < 0.1 || isNaN(dist)) dist = 2.0;
    targetCameraPosition = centroid.clone().normalize().multiplyScalar(-dist);
    isCentering = true;
}

export function stopCentering() {
    isCentering = false;
    targetCameraPosition = null;
}

export function getIsCentering() {
    return isCentering;
}

export function updateCameraCentering() {
    if (isCentering && targetCameraPosition) {
        controls.enabled = false;
        camera.position.lerp(targetCameraPosition, 0.05);
        camera.lookAt(0, 0, 0);
        
        if (camera.position.distanceTo(targetCameraPosition) < 0.005) {
            camera.position.copy(targetCameraPosition);
            isCentering = false;
            controls.enabled = true;
        }
    } else {
        controls.update();
    }
}

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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
