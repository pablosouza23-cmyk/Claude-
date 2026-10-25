'use strict';
// Pós-processamento "bodycam": a cena é desenhada numa textura e depois passa por um filtro de lente
// (olho de peixe, aberração cromática, brilho estourado, cor fria, vinheta e granulado de sensor).
const POST = { rt: null, quad: null, scene: null, cam: null, mat: null };

POST.ensure = function (renderer) {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  if (!POST.rt) {
    const gl2 = renderer.capabilities.isWebGL2;
    POST.rt = new THREE.WebGLRenderTarget(w, h, {
      type: gl2 && renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: gl2 && G.settings.quality === 'alta' ? 4 : 0,
      depthBuffer: true,
    });
    POST.mat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: POST.rt.texture }, time: { value: 0 }, res: { value: new THREE.Vector2(w, h) }, k: { value: 0.3 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float k; varying vec2 vUv;',
        'vec2 barrel(vec2 uv, float kk){ vec2 c = uv - 0.5; c.x *= res.x / res.y; float r2 = dot(c, c); c *= (1.0 + kk * r2) / (1.0 + kk * 0.42); c.x /= res.x / res.y; return c + 0.5; }',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'void main(){',
        ' vec2 uvG = barrel(vUv, k), uvR = barrel(vUv, k * 1.035), uvB = barrel(vUv, k * 0.965);',
        ' vec3 col = vec3(texture2D(tDiffuse, uvR).r, texture2D(tDiffuse, uvG).g, texture2D(tDiffuse, uvB).b);',
        // brilho estourado: só o que passa do branco espalha um pouco
        ' vec2 px = 3.0 / res;',
        ' vec3 bl = texture2D(tDiffuse, uvG + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uvG - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uvG + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uvG - vec2(0.0, px.y)).rgb;',
        ' col += max(bl * 0.25 - 0.85, 0.0) * 0.9;',
        ' gl_FragColor = vec4(col, 1.0);',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        ' vec3 c = gl_FragColor.rgb;',
        // cor de câmera policial: menos saturação, contraste, verde-azulado nas sombras
        ' float l = dot(c, vec3(0.299, 0.587, 0.114));',
        ' c = mix(vec3(l), c, 0.68);',
        ' c = (c - 0.5) * 1.14 + 0.5;',
        ' c = mix(c * vec3(0.92, 1.0, 1.04), c, smoothstep(0.0, 0.6, l)) + vec3(0.012, 0.014, 0.016);',
        // vinheta forte de lente grande-angular
        ' vec2 cc = (vUv - 0.5) * vec2(res.x / res.y, 1.0);',
        ' c *= smoothstep(1.15, 0.35, length(cc));',
        // granulado do sensor (muda a cada quadro) e linhas leves de compressão
        ' float g = hash(floor(vUv * res * 0.75) + fract(time * 37.0) * 91.0) - 0.5;',
        ' c += g * (0.07 + 0.05 * (1.0 - l));',
        ' c -= 0.012 * step(0.5, fract(vUv.y * res.y * 0.25));',
        ' if (uvG.x < 0.0 || uvG.x > 1.0 || uvG.y < 0.0 || uvG.y > 1.0) c = vec3(0.0);',
        ' gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
        '}'].join('\n'),
    });
    POST.scene = new THREE.Scene();
    POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST.mat);
    POST.quad.frustumCulled = false;
    POST.scene.add(POST.quad);
  }
  if (POST.rt.width !== w || POST.rt.height !== h) { POST.rt.setSize(w, h); POST.mat.uniforms.res.value.set(w, h); }
};

POST.begin = function (renderer) { POST.ensure(renderer); renderer.setRenderTarget(POST.rt); renderer.clear(); };
POST.end = function (renderer, t) {
  renderer.setRenderTarget(null);
  POST.mat.uniforms.time.value = t;
  renderer.render(POST.scene, POST.cam);
};
