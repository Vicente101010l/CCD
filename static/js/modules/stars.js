import * as THREE from 'three';
import { fetchStars } from './api.js';
import { camera, controls } from './three-scene.js';

export const starsGroup = new THREE.Group();
export let polarisStar = null;

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

export async function loadStars(onDone) {
    try {
        const starsData = await fetchStars();
        
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
                originalScale: size
            };

            if (starData.mag < 1.8 || (starData.name && starData.name.includes("Polaris"))) {
                const label = document.createElement('div');
                label.className = (starData.name && starData.name.includes("Polaris")) ? 'star-label-fixed' : 'star-label';
                label.innerText = starData.name;
                document.body.appendChild(label);
                star.userData.label = label;
            }

            if (starData.name && starData.name.includes("Polaris")) {
                polarisStar = star;
            }

            starsGroup.add(star);
        });
        
        if (typeof onDone === 'function') {
            onDone();
        }

    } catch (err) {
        console.error("Falha ao carregar estrelas no módulo stars.js:", err);
    }
}

export function updateStarLabels() {
    starsGroup.children.forEach(star => {
        if (star.userData.label) {
            const v = star.position.clone().project(camera);
            if (v.z < 1) { 
                const x = (v.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
                star.userData.label.style.transform = `translate(${x + 8}px, ${y - 8}px)`; 
                star.userData.label.style.display = 'block'; 
            } else {
                star.userData.label.style.display = 'none';
            }
        }
    });
}

export function updateCompass() {
    const compassNeedle = document.getElementById('compass-needle');
    if (!compassNeedle) return;
    
    if (polarisStar) {
        const dx = polarisStar.position.x - camera.position.x;
        const dz = polarisStar.position.z - camera.position.z;
        const angleToPolaris = Math.atan2(dx, dz);
        
        const fx = controls.target.x - camera.position.x;
        const fz = controls.target.z - camera.position.z;
        const cameraAngle = Math.atan2(fx, fz);
        
        const finalAngle = cameraAngle - angleToPolaris;
        compassNeedle.style.transform = `rotate(${finalAngle}rad)`;
    } else {
        const azimuth = controls.getAzimuthalAngle();
        compassNeedle.style.transform = `rotate(${-azimuth + Math.PI}rad)`;
    }
}
