'use strict';
/* Shared lighting for the 3D garden and the Arena. Colours are handled
   properly (sRGB in, filmic tone mapping out), every material is lit softly by
   an environment made from the scene's own sky (which also gives shiny things
   real reflections), and bright things like lanterns, fireflies and
   floodlights get a gentle bloom glow. "Fancy lighting" can be switched off in
   the garden's Effects menu for slower computers. */

if (window.THREE && THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
const fxHQ = () => (((typeof D !== 'undefined' && D) && D.game && D.game.fx) || {}).hq ?? true;
const fxMix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const srgb = t => { t.encoding = THREE.sRGBEncoding; return t; };

function fxRenderer() {
  const R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const low = typeof D === 'object' && D && D.settings && D.settings.lowQuality;
  R.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 2));
  R.outputEncoding = THREE.sRGBEncoding;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1;
  R.shadowMap.enabled = !low; R.shadowMap.type = THREE.PCFSoftShadowMap;
  // don't stop to read back every shader's compile log (it blocks the page
  // while the graphics driver compiles, and these shaders are known to work)
  R.debug.checkShaderErrors = false;
  // a new canvas is black until its first frame (which can take a moment while
  // shaders compile), so keep it invisible until something has been drawn
  const cv = R.domElement, draw = R.render.bind(R);
  cv.style.opacity = '0'; cv.style.transition = 'opacity .3s ease';
  R.render = (scene, cam) => { draw(scene, cam); if (cv.style.opacity === '0') requestAnimationFrame(() => { cv.style.opacity = ''; }); };
  return R;
}
// a sky dome: a smooth three-colour gradient with a soft glow around the sun
function fxSkyDome(radius, top, mid, bottom, sunDir, sunCol = '#fff3d6', sunSize = .9) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bottom) }, sun: { value: sunDir.clone().normalize() }, sunCol: { value: new THREE.Color(sunCol) }, sunSize: { value: sunSize } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunCol; uniform float sunSize; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.4, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(normalize(vDir), sun), 0.0); c += sunCol * (pow(s, 600.0) * 4.0 * sunSize + pow(s, 12.0) * 0.35 * sunSize);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat); m.renderOrder = -1; return m;
}
// soft image-based light: render a simple version of the sky into an environment map.
// Each renderer keeps its last one (and the generator, whose shaders are then
// compiled only once), so rebuilding the same scene doesn't make it again.
function fxEnv(R, scene, top, mid, bottom, sunDir, sunCol, groundCol) {
  const c = R.__env || (R.__env = {});
  const key = [top, mid, bottom, sunDir.x.toFixed(4), sunDir.y.toFixed(4), sunDir.z.toFixed(4), sunCol, groundCol].join('|');
  if (c.key === key && c.rt) { scene.environment = c.rt.texture; return c.rt; }
  const pm = c.pm || (c.pm = new THREE.PMREMGenerator(R)), env = new THREE.Scene();
  env.add(fxSkyDome(50, top, mid, bottom, sunDir, sunCol, 2.2));
  const g = new THREE.Mesh(new THREE.CircleGeometry(45, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: groundCol, toneMapped: false })); g.position.y = -3; env.add(g);
  const rt = pm.fromScene(env, .02);
  env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  if (scene.environment && scene.environment !== c.rt?.texture) scene.environment.dispose?.();
  if (c.rt) c.rt.dispose();
  c.key = key; c.rt = rt;
  scene.environment = rt.texture;
  return rt;
}
// Joins the meshes that never move relative to each other into one mesh per
// material, so the graphics card draws a tree in a few calls instead of
// dozens. Looks exactly the same. "dyn" holds the objects that move, turn or
// change shape on their own: each keeps its own place, and what hangs under
// it is joined relative to it.
function fxMergeStatic(root, dyn) {
  root.updateMatrixWorld(true);
  const plainRender = THREE.Object3D.prototype.onBeforeRender, bins = new Map(), inv = new THREE.Matrix4();
  const ok = m => m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && !dyn.has(m) && m.visible && !m.children.length && !Array.isArray(m.material) && m.material
    && !Object.keys(m.geometry.morphAttributes).length && m.onBeforeRender === plainRender && !Object.keys(m.userData).length && m.layers.mask === 1;
  // materials that differ only in colour can share one draw too: the colour goes
  // into the shape itself (vertex colours), which shades exactly the same
  const sigs = new Map(), plainCompile = THREE.Material.prototype.onBeforeCompile;
  const sig = (mat, g) => {
    if (!mat.isMeshStandardMaterial || mat.vertexColors || mat.map || mat.transparent || mat.onBeforeCompile !== plainCompile || g.attributes.color) return mat.uuid;
    let k = sigs.get(mat);
    if (k == null) { const j = mat.toJSON(); delete j.uuid; delete j.color; delete j.name; delete j.metadata; k = 'vc' + JSON.stringify(j); sigs.set(mat, k); }
    return k;
  };
  const visit = (node, box) => {
    for (const ch of node.children) {
      if (!ch.visible) continue;
      const own = dyn.has(ch);
      if (ok(ch)) {
        const g = ch.geometry, attrs = Object.keys(g.attributes).sort().map(k => { const a = g.attributes[k]; return `${k}${a.itemSize}${a.normalized ? 'n' : ''}${a.array.constructor.name}${a.isInterleavedBufferAttribute ? 'i' : ''}`; }).join(',');
        const k = [sig(ch.material, g), ch.castShadow, ch.receiveShadow, ch.renderOrder, ch.frustumCulled, attrs].join('|');
        let byBox = bins.get(box); if (!byBox) bins.set(box, byBox = new Map());
        (byBox.get(k) || byBox.set(k, []).get(k)).push(ch);
      }
      if (ch.children.length) visit(ch, own ? ch : box);
    }
  };
  visit(root, root);
  let joined = 0;
  for (const [box, byBox] of bins) {
    inv.copy(box.matrixWorld).invert();
    for (const list of byBox.values()) {
      if (list.length < 2 || list.some(m => Object.values(m.geometry.attributes).some(a => a.isInterleavedBufferAttribute))) continue;
      const tint = list.some(m => m.material !== list[0].material);
      // written straight into the joined arrays: positions moved into place,
      // normals turned to match, faces flipped back where a part was mirrored
      const names = Object.keys(list[0].geometry.attributes), nv = list.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
      const ni = list.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count), 0);
      const arrs = {}; for (const k of names) { const a = list[0].geometry.attributes[k]; arrs[k] = new a.array.constructor(nv * a.itemSize); }
      const col = tint ? new Float32Array(nv * 3) : null, idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      const mat = new THREE.Matrix4(), nm = new THREE.Matrix3(), e = mat.elements, q = nm.elements;
      let vo = 0, io = 0;
      for (const m of list) {
        const g = m.geometry, n = g.attributes.position.count;
        mat.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mat);
        for (const k of names) {
          const a = g.attributes[k], src = a.array, dst = arrs[k], w = a.itemSize, o = vo * w;
          if (k === 'position') for (let i = 0; i < n; i++) { const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], j = o + i * 3;
            dst[j] = e[0] * x + e[4] * y + e[8] * z + e[12]; dst[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; dst[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
          else if (k === 'normal') for (let i = 0; i < n; i++) { const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], j = o + i * 3;
            let X = q[0] * x + q[3] * y + q[6] * z, Y = q[1] * x + q[4] * y + q[7] * z, Z = q[2] * x + q[5] * y + q[8] * z; const L = Math.hypot(X, Y, Z) || 1;
            dst[j] = X / L; dst[j + 1] = Y / L; dst[j + 2] = Z / L; }
          else dst.set(src.subarray(0, n * w), o);
        }
        if (col) { const c = m.material.color; for (let i = 0; i < n; i++) { col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b; } }
        const flip = mat.determinant() < 0, src = g.index ? g.index.array : null, cnt = src ? g.index.count : n;
        for (let i = 0; i < cnt; i += 3) {
          const a = src ? src[i] : i, b = src ? src[i + 1] : i + 1, c = src ? src[i + 2] : i + 2;
          idx[io++] = vo + a; idx[io++] = vo + (flip ? c : b); idx[io++] = vo + (flip ? b : c);
        }
        vo += n;
      }
      const out = new THREE.BufferGeometry();
      for (const k of names) { const a = list[0].geometry.attributes[k]; out.setAttribute(k, new THREE.BufferAttribute(arrs[k], a.itemSize, a.normalized)); }
      if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      const f = list[0]; let fm = f.material;
      if (tint) { fm = f.material.clone(); fm.color.setRGB(1, 1, 1); fm.vertexColors = true; }
      const m = new THREE.Mesh(out, fm);
      m.castShadow = f.castShadow; m.receiveShadow = f.receiveShadow; m.renderOrder = f.renderOrder; m.frustumCulled = f.frustumCulled;
      for (const x of list) { x.parent.remove(x); x.geometry.dispose(); }
      box.add(m); joined += list.length - 1;
    }
  }
  return joined;
}
// bloom on top of the normal render (only with fancy lighting on)
function fxComposer(R, scene, cam, o = {}) {
  if (!THREE.EffectComposer) return null;
  const sz = R.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: R.capabilities.isWebGL2 ? 4 : 0 });
  const c = new THREE.EffectComposer(R, rt);
  c.addPass(new THREE.RenderPass(scene, cam));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), o.strength ?? .45, o.radius ?? .5, o.threshold ?? .82);
  c.addPass(bloom);
  c.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  return { c, bloom };
}
function fxResize(R, comp, w, h) {
  R.setSize(w, h, false);
  if (comp) { comp.c.setPixelRatio(R.getPixelRatio()); comp.c.setSize(w, h); }
}
// a soft round shadow texture, laid flat under things so they sit on the ground
function fxBlobTex() {
  if (fxBlobTex.t) return fxBlobTex.t;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (fxBlobTex.t = new THREE.CanvasTexture(c));
}
function fxBlob(r, op = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxBlobTex(), transparent: true, depthWrite: false, opacity: op, toneMapped: false }));
  m.position.y = .015; m.renderOrder = 1; return m;
}
