/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; js-indent-level: 2 -*- */

/* Copyright 2022 Itseez3D, Inc. <support@itseez3d.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the
 *    distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


import * as THREE from './three/three.module.js';
import WebGL from './three/jsm/capabilities/WebGL.js';
import Stats from './three/jsm/libs/stats.module.js';
import { GLTFLoader } from './three/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './three/jsm/controls/OrbitControls.js';


const FOV = 45, WIDTH = 300, HEIGHT = 200;

let stats, scene, camera, renderer, controls;


export function init_gl(target, options) {
  if (!WebGL.isWebGLAvailable()) {
    const warning = WebGL.getWebGLErrorMessage();
    target.parentElement.appendChild(warning);
    return;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(FOV, WIDTH/HEIGHT, 0.1, 1000);
  camera.position.set(1, 1, 1);

  renderer = new THREE.WebGLRenderer({canvas: target, antialias: true});
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0xe6e6e6);
  renderer.shadowMap.enabled = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  let frontLight = new THREE.DirectionalLight(0xffffff, 3);
  frontLight.position.set(10,10,10);
  frontLight.castShadow = true;
  frontLight.shadow.mapSize.set(1024, 1024);
  frontLight.shadow.bias = -1e-4;
  scene.add(frontLight);

  let backLight = new THREE.DirectionalLight(0xffffff, 1);
  backLight.position.set(-10,2,-2);
  backLight.castShadow = true;
  backLight.shadow.mapSize.set(1024, 1024);
  backLight.shadow.bias = -1e-4;
  scene.add(backLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();

  if (!!options?.stats) {
    stats = new Stats();
    stats.dom.style.position = 'absolute';
    stats.dom.style.right = '0';
    target.parentElement.appendChild(stats.dom);
  }

  animate();

  window.addEventListener('resize', _adjustRendererSize);
}


function animate() {
  requestAnimationFrame(animate);

  if (!!stats) stats.update();

  renderer.render(scene, camera);
}


export function display(modelFiles) {
  // https://threejs.org/docs/index.html#api/en/loaders/managers/LoadingManager
  let manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!(url in modelFiles)) return url;

    return URL.createObjectURL(modelFiles[url]);
  })

  let model = modelFiles['model.glb'];

  const loader = new GLTFLoader(manager);

  return model.arrayBuffer().then((abuf) => {
    return new Promise((resolve, reject) => {
      loader.parse(abuf, '', resolve, reject);
    })
  }).then((gltf) => {
    _adjustRendererSize();

    let maxSphere = undefined;
    gltf.scene.traverse((c) => {
      if (!c.isMesh) return;

      _adjustMeshProperties(c);

      if (!maxSphere) {
        maxSphere = c.geometry.boundingSphere;
      } else {
        let greater = c.geometry.boundingSphere.radius > maxSphere.radius;
        if (greater) maxSphere = c.geometry.boundingSphere;
      }
    });

    scene.add(gltf.scene);

    let h = maxSphere.radius * 2 * 1.1;
    let d = h / (2 * Math.tan(THREE.MathUtils.degToRad(FOV/2)));

    camera.position.set(maxSphere.center.x, maxSphere.center.y, maxSphere.center.z + d);
    camera.lookAt(maxSphere.center);
    controls.target.copy(maxSphere.center);
    controls.update();
  });
}


export function reset() {
  _adjustRendererSize();

  let objectsToRemove = scene.children.filter((c) => !(c.isLight || c.isCamera));
  scene.remove(...objectsToRemove);

  camera.position.set(1, 1, 1);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}


function _adjustRendererSize() {
  let width = WIDTH, height = HEIGHT;

  if (renderer.domElement == document.fullscreenElement) {
    width = window.innerWidth;
    height = window.innerHeight;
  } else {
    let parent = renderer.domElement.parentElement;

    width = parent.offsetWidth;
    height = 1.0 * width * HEIGHT / WIDTH;
  }

  renderer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}


function _adjustMeshProperties(mesh) {
  console.log('adjust ' + mesh.name);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.material.side = THREE.DoubleSide;

  if (mesh.name.startsWith('haircut')) {
    mesh.material.transparent = true;
  } else if (mesh.name.startsWith('outfit')) {
    mesh.material.depthWrite = true;
  }
}
