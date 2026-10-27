'use strict';
/* Shared lighting for the 3D garden and the Arena. Colours are handled
   properly (sRGB in, filmic tone mapping out), every material is lit softly by
   an environment made from the scene's own sky (which also gives shiny things
   real reflections), and bright things like lanterns, fireflies and
   floodlights get a gentle bloom glow. "Fancy lighting" can be switched off in
   the garden's Effects menu for slower computers. */

if (window.THREE && THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
const fxHQ = () => ((window.D && D.game && D.game.fx) || {}).hq ?? true;
const fxMix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const srgb = t => { t.encoding = THREE.sRGBEncoding; return t; };

function fxRenderer() {
  const R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  R.outputEncoding = THREE.sRGBEncoding;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
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
// soft image-based light: render a simple version of the sky into an environment map
function fxEnv(R, scene, top, mid, bottom, sunDir, sunCol, groundCol) {
  const pm = new THREE.PMREMGenerator(R), env = new THREE.Scene();
  env.add(fxSkyDome(50, top, mid, bottom, sunDir, sunCol, 2.2));
  const g = new THREE.Mesh(new THREE.CircleGeometry(45, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: groundCol, toneMapped: false })); g.position.y = -3; env.add(g);
  const rt = pm.fromScene(env, .02); pm.dispose();
  env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  if (scene.environment) scene.environment.dispose?.();
  scene.environment = rt.texture;
  return rt;
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
