import * as THREE from 'three';

// Import Mediapipe secara direct
const hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClearColor = false; 
document.body.appendChild(renderer.domElement);

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
const material = new THREE.PointsMaterial({ size: 0.07, color: 0x00ff88, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
const particles = new THREE.Points(geometry, material);
scene.add(particles);
camera.position.z = 20;

let targetPos = new THREE.Vector3(0, 0, 0), targetRot = new THREE.Euler(0, 0, 0), targetScale = 1;
let currentPos = new THREE.Vector3(0, 0, 0), isLoveMode = false, lastPattern = 'Box';

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        targetPos.set((0.5 - lm[9].x) * 30, (0.5 - lm[9].y) * 20, 0);
        targetRot.set(0, (lm[3].x - lm[17].x) * 2, Math.atan2(lm[9].y - lm[0].y, lm[9].x - lm[0].x) + Math.PI/2);
        targetScale = Math.sqrt(Math.pow(lm[9].x - lm[0].x, 2) + Math.pow(lm[9].y - lm[0].y, 2)) * 8;

        const distPinch = Math.sqrt(Math.pow(lm[4].x - lm[8].x, 2) + Math.pow(lm[4].y - lm[8].y, 2));
        const openCount = [lm[8].y < lm[6].y, lm[12].y < lm[10].y, lm[16].y < lm[14].y, lm[20].y < lm[18].y].filter(Boolean).length;
        const isThumbUp = lm[4].y < lm[3].y && lm[4].y < lm[2].y;

        let detected = (openCount >= 3) ? 'Sphere' : (distPinch < 0.08 ? 'Heart' : (isThumbUp && openCount === 0 ? 'Box' : lastPattern));

        if (detected !== lastPattern) {
            if (detected === 'Heart') { setHeartPattern(); isLoveMode = true; particles.material.color.set('#ff0066'); }
            else if (detected === 'Sphere') { setSpherePattern(); isLoveMode = false; particles.material.color.set(0x2f43a5); }
            else if (detected === 'Box') { setBoxPattern(); isLoveMode = false; particles.material.color.set(0x00ff88); }
            lastPattern = detected;
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    currentPos.lerp(targetPos, 0.1);
    particles.position.copy(currentPos);
    particles.rotation.set(
        THREE.MathUtils.lerp(particles.rotation.x, targetRot.x, 0.1),
        THREE.MathUtils.lerp(particles.rotation.y, targetRot.y, 0.1),
        THREE.MathUtils.lerp(particles.rotation.z, targetRot.z, 0.1)
    );
    const s = THREE.MathUtils.lerp(particles.scale.x, targetScale, 0.1);
    particles.scale.set(s, s, s);
    if (isLoveMode) particles.scale.multiplyScalar(1 + Math.sin(Date.now() * 0.01) * 0.15);
    renderer.render(scene, camera);
}

const videoElement = document.getElementById('webcam');
async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream; videoElement.play();
    const cameraUtils = new window.Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); } });
    cameraUtils.start();
}

// Load Mediapipe scripts secara dinamik (Penting untuk GitHub Pages)
const script1 = document.createElement('script'); script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const script2 = document.createElement('script'); script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
document.head.appendChild(script1); document.head.appendChild(script2);

script2.onload = () => { start(); animate(); };
