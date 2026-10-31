import * as THREE from 'three';

/** One GPU context, three scenes. The canvas moves to the visible scene's host. */
export function createWorld() {
  const hosts = [...document.querySelectorAll('[data-webgl]')];
  if (!hosts.length) return { setMotion() {}, setPointer() {}, dispose() {} };
  const mobile = matchMedia('(max-width: 680px)').matches;
  const clamp = THREE.MathUtils.clamp;
  const canvas = document.createElement('canvas');
  canvas.className = 'hex-webgl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'low-power' });
  } catch {
    document.documentElement.classList.add('webgl-fallback');
    return { setMotion() {}, setPointer() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pointer = { x: 0, y: 0 };
  const scenes = [];
  let active = null, enabled = false, frame = 0, lastTime = 0, disposed = false;

  function lights(scene) {
    scene.add(new THREE.AmbientLight(0x8bbaff, 2.2));
    const key = new THREE.DirectionalLight(0xc5e4ff, 5); key.position.set(3, 4, 6); scene.add(key);
    const rim = new THREE.PointLight(0x126aff, 35, 30); rim.position.set(-4, -1, 4); scene.add(rim);
  }
  function hexShape(radius) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6;
      if (!i) shape.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    shape.closePath(); return shape;
  }
  function hexRing(radius, thickness, depth, material) {
    const shape = hexShape(radius), hole = new THREE.Path();
    for (let i = 5; i >= 0; i--) {
      const a = Math.PI / 3 * i + Math.PI / 6, r = radius - thickness;
      if (i === 5) hole.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    hole.closePath(); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geometry, material);
  }
  function orbit(radius, color, opacity = .5) {
    return new THREE.Mesh(new THREE.TorusGeometry(radius, .009, 5, 90), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  }
  function dust(count, spread, color, size) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - .5) * spread;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: .65, depthWrite: false }));
  }
  function make(host, kind, build) {
    const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root); lights(scene);
    const camera = new THREE.PerspectiveCamera(kind === 'tunnel' ? 65 : 38, 1, .1, 120); camera.position.z = kind === 'tunnel' ? 7 : 10;
    const state = { host, kind, scene, root, camera, data: {}, visible: false, ratio: 0 };
    build(state); scenes.push(state); host.dataset.webglReady = 'true';
    return state;
  }

  const heroHost = hosts.find(host => host.dataset.webgl === 'hero');
  if (heroHost) make(heroHost, 'hero', state => {
    const ring = hexRing(3.25, .045, .09, new THREE.MeshStandardMaterial({ color: 0x1747e0, metalness: .8, roughness: .24, transparent: true, opacity: .65 }));
    ring.rotation.set(.12, -.28, .12); state.root.add(ring);
    const ring2 = orbit(3.65, 0x4d79ff, .28); ring2.rotation.set(.7, .4, 0); state.root.add(ring2);
    const ring3 = orbit(2.8, 0x7aa2ff, .25); ring3.rotation.set(1.15, -.5, 0); state.root.add(ring3);
    const shards = new THREE.Group(), geometry = new THREE.OctahedronGeometry(.12);
    for (let i = 0; i < 14; i++) {
      const shard = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: i % 3 ? 0x245cff : 0x9cdeff, metalness: .65, roughness: .2 }));
      const a = i / 14 * Math.PI * 2; shard.position.set(Math.cos(a) * 3.65, Math.sin(a) * 3.65, Math.sin(a * 2) * .8); shard.rotation.set(a, a * 2, a); shards.add(shard);
    }
    state.root.add(shards);
    const particles = dust(mobile ? 60 : 120, 11, 0x7aa2ff, .025); state.root.add(particles);
    state.data = { ring, ring2, ring3, shards, particles };
  });

  const badgeHost = hosts.find(host => host.dataset.webgl === 'badge');
  if (badgeHost) make(badgeHost, 'badge', state => {
    const badge = new THREE.Group(); state.root.add(badge);
    badge.add(hexRing(2.05, .16, .28, new THREE.MeshPhysicalMaterial({ color: 0x245cff, metalness: .82, roughness: .2, clearcoat: 1, clearcoatRoughness: .15 })));
    const inner = hexRing(1.78, .025, .08, new THREE.MeshBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: .65 })); inner.position.z = .18; badge.add(inner);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(1.83, 6), new THREE.MeshStandardMaterial({ color: 0x071426, metalness: .5, roughness: .45, side: THREE.DoubleSide })); plate.rotation.z = Math.PI / 6; plate.position.z = -.12; badge.add(plate);
    const texture = new THREE.TextureLoader().load('/images/hex-wolf.webp'); texture.colorSpace = THREE.SRGBColorSpace;
    const wolf = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 3.22), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })); wolf.position.set(0, .02, .22); badge.add(wolf);
    const back = hexRing(2.2, .025, .06, new THREE.MeshBasicMaterial({ color: 0x245cff, transparent: true, opacity: .4 })); back.position.z = -.35; badge.add(back);
    const orbitA = orbit(2.65, 0x4d79ff, .55); orbitA.rotation.set(1.05, .25, -.3); state.root.add(orbitA);
    const orbitB = orbit(2.9, 0x9db4ff, .25); orbitB.rotation.set(.45, 1.1, .4); state.root.add(orbitB);
    const satellite = new THREE.Mesh(new THREE.OctahedronGeometry(.09), new THREE.MeshBasicMaterial({ color: 0xb3eaff })); satellite.position.x = 2.65; orbitA.add(satellite);
    const particles = dust(50, 7, 0x4d79ff, .025); state.root.add(particles);
    state.root.rotation.x = .08;
    state.data = { badge, orbitA, orbitB, particles, dragX: 0, dragY: 0, dragging: false, lastX: 0, lastY: 0 };
  });

  const tunnelHost = hosts.find(host => host.dataset.webgl === 'tunnel');
  if (tunnelHost) make(tunnelHost, 'tunnel', state => {
    const rings = new THREE.Group(); state.root.add(rings);
    const geometry = new THREE.BufferGeometry().setFromPoints(hexShape(4.2).getPoints().map(p => new THREE.Vector3(p.x, p.y, 0)));
    for (let i = 0; i < 18; i++) {
      const ring = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: i % 3 ? 0x245cff : 0x9db4ff, transparent: true, opacity: .18 + i % 3 * .1 }));
      ring.position.z = -i * 4; ring.rotation.z = i * .035; rings.add(ring);
    }
    const particles = dust(mobile ? 140 : 300, 22, 0x7aa2ff, .035); particles.position.z = -15; state.root.add(particles);
    state.data = { rings, particles };
  });

  function resize() {
    if (!active) return;
    const rect = active.host.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    active.camera.aspect = rect.width / Math.max(1, rect.height); active.camera.updateProjectionMatrix();
  }
  function chooseScene() {
    if (disposed) return;
    let best = null, bestRatio = 0;
    for (const state of scenes) {
      const rect = state.host.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      state.ratio = visibleHeight / Math.max(1, Math.min(rect.height, innerHeight));
      if (state.ratio > bestRatio) { best = state; bestRatio = state.ratio; }
    }
    if (best === active) return;
    active?.host.classList.remove('webgl-ready');
    active = bestRatio > .08 ? best : null;
    if (active) {
      active.host.prepend(canvas); active.host.classList.add('webgl-ready');
      const interactive = active.kind === 'badge' && enabled;
      canvas.tabIndex = interactive ? 0 : -1;
      canvas.setAttribute('role', interactive ? 'img' : 'presentation');
      canvas.setAttribute('aria-label', interactive ? 'Interactive 3D TEAM HEX emblem. Drag or use arrow keys to rotate.' : '');
      canvas.setAttribute('aria-hidden', interactive ? 'false' : 'true');
      canvas.style.pointerEvents = interactive ? 'auto' : 'none';
      resize();
    } else canvas.remove();
  }
  const observer = new IntersectionObserver(() => { chooseScene(); if (active && enabled) start(); }, { rootMargin: '100px' });
  hosts.forEach(host => observer.observe(host));
  const resizeObserver = new ResizeObserver(resize); hosts.forEach(host => resizeObserver.observe(host));
  addEventListener('scroll', chooseScene, { passive: true });
  addEventListener('resize', chooseScene, { passive: true });

  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (!enabled || active?.kind !== 'badge') return;
    drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || active?.kind !== 'badge') return;
    active.data.dragX += (event.clientX - drag.x) * .009;
    active.data.dragY = clamp(active.data.dragY + (event.clientY - drag.y) * .006, -.6, .6);
    drag = { x: event.clientX, y: event.clientY };
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', event => {
    if (!enabled || active?.kind !== 'badge' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const data = active.data;
    if (event.key === 'ArrowLeft') data.dragX -= .18;
    if (event.key === 'ArrowRight') data.dragX += .18;
    if (event.key === 'ArrowUp') data.dragY = clamp(data.dragY - .12, -.6, .6);
    if (event.key === 'ArrowDown') data.dragY = clamp(data.dragY + .12, -.6, .6);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); setMotion(false); document.documentElement.classList.add('webgl-fallback');
  });

  function render(time) {
    frame = 0;
    if (!enabled || disposed || document.hidden || !active) return;
    frame = requestAnimationFrame(render);
    if (time - lastTime < 33) return; // One context, 30fps maximum.
    lastTime = time;
    const t = time * .001, { root, data, kind } = active;
    const rect = active.host.getBoundingClientRect();
    const progress = clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
    if (kind === 'hero') {
      data.ring.rotation.z = t * .045 + progress * .8;
      data.ring.rotation.y = -.28 + Math.sin(t * .22) * .16 + pointer.x * .12;
      data.ring2.rotation.z = -t * .07; data.ring3.rotation.y = t * .09;
      data.shards.rotation.z = -t * .035; data.particles.rotation.y = t * .018;
      root.rotation.x += (pointer.y * .08 - root.rotation.x) * .05;
      root.position.y = .2 + Math.sin(t * .5) * .08;
    } else if (kind === 'badge') {
      const targetY = Math.sin(t * .32) * .2 + (progress - .5) * 1.1 + data.dragX + pointer.x * .12;
      const targetX = .08 + data.dragY + pointer.y * .08;
      data.badge.rotation.y += (targetY - data.badge.rotation.y) * .085;
      data.badge.rotation.x += (targetX - data.badge.rotation.x) * .085;
      data.badge.position.y = Math.sin(t * .8) * .07;
      data.orbitA.rotation.z = t * .12; data.orbitB.rotation.z = -t * .09; data.particles.rotation.z = t * .025;
    } else {
      const section = active.host.closest('.protocol-section');
      const scroll = section ? clamp(-section.getBoundingClientRect().top / Math.max(1, section.offsetHeight - innerHeight), 0, 1) : progress;
      data.rings.children.forEach((ring, i) => { ring.position.z = -72 + ((i * 4 + t * 1.25 + scroll * 30) % 72); ring.rotation.z = i * .035 + t * .018 + scroll * .4; });
      root.rotation.z = Math.sin(t * .1) * .035 + scroll * .12; data.particles.rotation.z = -t * .012;
    }
    renderer.render(active.scene, active.camera);
  }
  function start() { if (!frame && enabled && !disposed && !document.hidden && active) { lastTime = performance.now(); frame = requestAnimationFrame(render); } }
  function setMotion(value) {
    enabled = value;
    if (enabled) { chooseScene(); start(); }
    else { cancelAnimationFrame(frame); frame = 0; active?.host.classList.remove('webgl-ready'); canvas.remove(); active = null; }
  }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); };
  document.addEventListener('visibilitychange', visibility);
  chooseScene();
  return {
    setMotion,
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
      removeEventListener('scroll', chooseScene); removeEventListener('resize', chooseScene); document.removeEventListener('visibilitychange', visibility);
      scenes.forEach(state => state.scene.traverse(object => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach(material => { material.map?.dispose(); material.dispose(); });
      }));
      renderer.dispose(); canvas.remove();
    },
  };
}
