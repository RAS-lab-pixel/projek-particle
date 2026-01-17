import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';
import GUI from 'lil-gui';

// --- 1. SETUP SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClearColor = false; 
document.body.appendChild(renderer.domElement);

// --- 2. PARTICLE PATTERNS ---
const particleCount = 3000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

function setBoxPattern() {
    for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 10;
    geometry.attributes.position.needsUpdate = true;
}

function setSpherePattern() {
    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        positions[i * 3] = 4 * Math.cos(theta) * Math.sin(phi);
        positions[i * 3 + 1] = 4 * Math.sin(theta) * Math.sin(phi);
        positions[i * 3 + 2] = 4 * Math.cos(phi);
    }
    geometry.attributes.position.needsUpdate = true;
}

function setHeartPattern() {
    for (let i = 0; i < particleCount; i++) {
        const t = (i / particleCount) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        positions[i * 3] = x / 4;
        positions[i * 3 + 1] = y / 4;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3; 
    }
    geometry.attributes.position.needsUpdate = true;
}

setBoxPattern();

const material = new THREE.PointsMaterial({ 
    size: 0.07, 
    color: 0x00ff88, 
    transparent: true, 
    opacity: 0.8,
    blending: THREE.AdditiveBlending 
});
const particles = new THREE.Points(geometry, material);
scene.add(particles);
camera.position.z = 20;

// --- 3. UI & TRACKING ---
const gui = new GUI();
const settings = { color: '#00ff88', trailOpacity: 0.15, followSpeed: 0.1 };
gui.addColor(settings, 'color').onChange(v => { if (lastPattern === 'Box') particles.material.color.set(v); });
gui.add(settings, 'trailOpacity', 0.01, 0.4).name('Trail Length');

let targetPos = new THREE.Vector3(0, 0, 0);
let targetRot = new THREE.Euler(0, 0, 0);
let targetScale = 1;
let currentPos = new THREE.Vector3(0, 0, 0);
let isLoveMode = false;
let lastPattern = 'Box';

// --- 4. HAND TRACKING (Isyarat Thumbs Up 👍) ---
const videoElement = document.getElementById('webcam');
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // Position & Rotation Tracking
        targetPos.set((0.5 - lm[9].x) * 30, (0.5 - lm[9].y) * 20, 0);
        const dX = lm[9].x - lm[0].x;
        const dY = lm[9].y - lm[0].y;
        targetRot.set(0, (lm[3].x - lm[17].x) * 2, Math.atan2(dY, dX) + Math.PI/2);
        
        const dist3D = Math.sqrt(Math.pow(lm[9].x - lm[0].x, 2) + Math.pow(lm[9].y - lm[0].y, 2));
        targetScale = dist3D * 8;

        // Logik Pengesanan Baru
        const distPinch = Math.sqrt(Math.pow(lm[4].x - lm[8].x, 2) + Math.pow(lm[4].y - lm[8].y, 2));
        
        // Jari terbuka (Index, Middle, Ring, Pinky)
        const isIndexOpen = lm[8].y < lm[6].y;
        const isMiddleOpen = lm[12].y < lm[10].y;
        const isRingOpen = lm[16].y < lm[14].y;
        const isPinkyOpen = lm[20].y < lm[18].y;
        const openCount = [isIndexOpen, isMiddleOpen, isRingOpen, isPinkyOpen].filter(Boolean).length;

        // Ciri Thumbs Up: Ibu jari (4) lebih tinggi dari sendi (3, 2) & jari lain tutup
        const isThumbUp = lm[4].y < lm[3].y && lm[4].y < lm[2].y;

        let detected = lastPattern;

        if (openCount >= 3) {
            detected = 'Sphere';
        } else if (distPinch < 0.08) {
            detected = 'Heart';
        } else if (isThumbUp && openCount === 0) {
            detected = 'Box';
        }

        if (detected !== lastPattern) {
            if (detected === 'Heart') { 
                setHeartPattern(); 
                isLoveMode = true; 
                particles.material.color.set('#ff0066'); 
            }
            else if (detected === 'Sphere') { 
                setSpherePattern(); 
                isLoveMode = false; 
                particles.material.color.set(0x2f43a5); 
            }
            else if (detected === 'Box') { 
                setBoxPattern(); 
                isLoveMode = false; 
                particles.material.color.set(settings.color); 
            }
            lastPattern = detected;
        }
    }
});

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    const fadeOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: settings.trailOpacity })
    );
    fadeOverlay.position.z = 10;
    scene.add(fadeOverlay);

    currentPos.lerp(targetPos, settings.followSpeed);
    particles.position.copy(currentPos);
    
    particles.rotation.x = THREE.MathUtils.lerp(particles.rotation.x, targetRot.x, 0.1);
    particles.rotation.y = THREE.MathUtils.lerp(particles.rotation.y, targetRot.y, 0.1);
    particles.rotation.z = THREE.MathUtils.lerp(particles.rotation.z, targetRot.z, 0.1);

    const s = THREE.MathUtils.lerp(particles.scale.x, targetScale, 0.1);
    particles.scale.set(s, s, s);

    if (isLoveMode) {
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.15;
        particles.scale.multiplyScalar(pulse);
    }
    
    renderer.render(scene, camera);
    scene.remove(fadeOverlay);
}

async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    videoElement.play();
    const sendVideo = async () => {
        await hands.send({ image: videoElement });
        requestAnimationFrame(sendVideo);
    };
    sendVideo();
}

start();
animate();