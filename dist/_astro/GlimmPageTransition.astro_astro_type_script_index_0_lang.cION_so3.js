var R=e=>e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4),Q=(e,a,t)=>{const c=.4122214708*e+.5363325363*a+.0514459929*t,d=.2119034982*e+.6806995451*a+.1073969566*t,m=.0883024619*e+.2817188376*a+.6299787005*t,l=Math.cbrt(c),n=Math.cbrt(d),s=Math.cbrt(m);return[.2104542553*l+.793617785*n-.0040720468*s,1.9779984951*l-2.428592205*n+.4505937099*s,.0259040371*l+.7827717662*n-.808675766*s]},G=e=>{const[a,t,c]=Q(R(e[0]),R(e[1]),R(e[2]));return{L:a,C:Math.sqrt(t*t+c*c),H:Math.atan2(c,t)}},Y=e=>{const a=parseInt(e.replace("#",""),16);return[(a>>16&255)/255,(a>>8&255)/255,(a&255)/255]},j={red:"#FF3D7F",orange:"#FF7A1A",yellow:"#FFD600",green:"#C2FF3D",mint:"#00FFA8",teal:"#00E5D6",cyan:"#1FC8FF",blue:"#2E70FF",indigo:"#7B4FFF",purple:"#D33CFF",pink:"#FF3DC0",brown:"#D8A87B"};Object.fromEntries(Object.entries(j).map(([e,a])=>[e,G(Y(a))]));var _={prism:{a:[.46,.88,.33],b:[.6,.58,.74],c:[.5,.5,.5],d:[.54,.22,.84]},berry:{a:[.92,.36,.56],b:[.1,.14,.37],c:[.5,.5,.5],d:[.84,.11,.5]},lagoon:{a:[.58,.64,.52],b:[.64,.3,.5],c:[.5,.5,.5],d:[.37,.66,.89]},citrus:{a:[.55,.61,.61],b:[.54,.41,.63],c:[.5,.5,.5],d:[.66,.92,.23]},azure:{a:[.13,.61,1],b:[.15,.14,0],c:[.5,.5,.5],d:[.29,.98,.74]},ember:{a:[.83,.61,.6],b:[.2,.41,.62],c:[.5,.5,.5],d:[.73,.05,.36]}};function z(e){return e?typeof e=="string"?_[e]:e:_.prism}var K=`
attribute vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }
`,J=`
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
uniform float uAlpha;
uniform float uBandTight;
uniform float uPosStart;
uniform float uPosEnd;
uniform float uHueShift;
uniform float uDirection; // 0 = horizontal, 1 = vertical
uniform float uWaveAmount;   // 0..2, multiplies edge wave displacement
uniform float uRippleAmount; // 0..2, multiplies vertical ripple intensity
uniform float uWaveSpeed;    // 0..3, multiplies all time-based motion
uniform float uBrightness;   // 0..1.5, scales the band's RGB before composite
uniform float uSwellAmount;  // 0..1, depth/iridescence intensity. 0 = flat band.
uniform vec3 uPalA;
uniform vec3 uPalB;
uniform vec3 uPalC;
uniform vec3 uPalD;

#define PI 3.14159265359

vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
  return a + b * cos(2.0 * PI * (c * t + d));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float axis  = mix(uv.x, uv.y, uDirection);
  float cross = mix(uv.y, uv.x, uDirection);

  float pos = uPosStart + uProgress * (uPosEnd - uPosStart);

  float tw = uTime * uWaveSpeed;

  float waveX =
      sin(cross *  6.0 + tw * 1.3) * 0.020
    + sin(cross * 13.0 - tw * 0.9 + 1.4) * 0.012
    + sin(cross * 21.0 + tw * 1.7 + 2.6) * 0.006;
  waveX *= uWaveAmount;

  float d = (axis - pos) - waveX;
  float band = exp(-d * d * uBandTight);

  // Analytic slope of the band's pseudo-elevation map along the travel
  // axis only. We deliberately ignore the cross-axis chain-rule term
  // (∂waveX/∂cross) — letting the high-frequency edge wobble leak into
  // the normal made iridescence shimmer at the wave's frequency, which
  // read as "too wavy". Keeping the cross slope at zero gives a clean
  // left→right hue sweep that matches the iOS name-drop feel.
  float dhDaxis = -2.0 * d * uBandTight * band;
  vec2 slope;
  slope.x = mix(dhDaxis, 0.0, uDirection);
  slope.y = mix(0.0, dhDaxis, uDirection);

  // Synthesised surface normal. The 0.18 gain controls perceived
  // height — higher = steeper flanks, more dramatic iridescent shift.
  vec3 N = normalize(vec3(-slope.x * 0.18, slope.y * 0.18, 1.0));

  float trail = clamp(0.5 - d * 1.3, 0.0, 1.0);
  trail = pow(trail, 2.5) * 0.30;

  float intensity = max(band * 0.95, trail);

  // Cover the full screen edge-to-edge so fixed UI (tabs, toggles) is hidden
  // during the sweep. A barely-perceptible 1.5% fade keeps the look soft
  // without exposing pixels at the viewport edges.
  float vfade = smoothstep(0.0, 0.015, cross) * smoothstep(1.0, 0.985, cross);

  // Hue rotates with the synthesised normal — the trick that reads as
  // iOS-name-drop iridescence — but on a deliberately gentle scale so
  // the foil shift looks calm, not strobing.
  float t = N.x * 0.45 + N.y * 0.30
          + axis * 1.4 + cross * 0.35
          + uHueShift + uTime * 0.04;
  vec3 col = pal(t, uPalA, uPalB, uPalC, uPalD);
  col *= uBrightness;

  // Fixed key light + camera looking down +z. View-independent because
  // there's no real camera; this gives a stable highlight that travels
  // across the crest as the band moves, instead of one that wobbles with
  // viewport size.
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(0.35, 0.55, 0.9));
  vec3 H = normalize(L + V);
  float NdotH = clamp(dot(N, H), 0.0, 1.0);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - NdotV, 3.0);
  float spec    = pow(NdotH, 80.0);

  // Edge fade: as the band's traversal progress nears 0 or 1 (entering or
  // exiting the screen) the band reads at 20% alpha; at midpoint it's at
  // 100%. Softens the band's appearance/disappearance so it doesn't pop
  // into existence at full strength.
  float entryFade = mix(0.2, 1.0, 4.0 * uProgress * (1.0 - uProgress));

  // Body — palette colour where the band has presence. Premultiplied.
  float bodyA = intensity * vfade * uAlpha * entryFade;
  vec3  bodyPM = col * bodyA;

  // Highlights are emissive — they add light without occluding the page,
  // gated to the band's body so they only fire on the crest, not the wake.
  float highMask = band * vfade * uAlpha * entryFade * uSwellAmount;
  vec3  highEmit = (col * fresnel * 0.55 + vec3(spec) * 1.1) * highMask;
  float highA    = (fresnel * 0.4 + spec * 0.9) * highMask;

  gl_FragColor = vec4(bodyPM + highEmit, min(bodyA + highA, 1.0));
}
`,Z=e=>{switch(e){case"ltr":return{axis:0,posStart:-.2,posEnd:1.2};case"rtl":return{axis:0,posStart:1.2,posEnd:-.2};case"ttb":return{axis:1,posStart:-.2,posEnd:1.2};case"btt":return{axis:1,posStart:1.2,posEnd:-.2}}};function $(e={}){if(typeof window>"u")return null;const a=e.canvas??document.createElement("canvas"),t=a.getContext("webgl",{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!t)return null;const c=(i,b)=>{const g=t.createShader(i);return t.shaderSource(g,b),t.compileShader(g),t.getShaderParameter(g,t.COMPILE_STATUS)||console.error("[glimm] shader compile error:",t.getShaderInfoLog(g)),g},d=c(t.VERTEX_SHADER,K),m=c(t.FRAGMENT_SHADER,J),l=t.createProgram();t.attachShader(l,d),t.attachShader(l,m),t.linkProgram(l),t.useProgram(l);const n=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,n),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW);const s=t.getAttribLocation(l,"a");t.enableVertexAttribArray(s),t.vertexAttribPointer(s,2,t.FLOAT,!1,0,0);const r=i=>t.getUniformLocation(l,i),u=r("uRes"),p=r("uTime"),A=r("uProgress"),h=r("uAlpha"),v=r("uBandTight"),P=r("uPosStart"),S=r("uPosEnd"),w=r("uHueShift"),M=r("uDirection"),f=r("uWaveAmount"),y=r("uRippleAmount"),F=r("uWaveSpeed"),E=r("uBrightness"),T=r("uSwellAmount"),H=r("uPalA"),W=r("uPalB"),q=r("uPalC"),U=r("uPalD");t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA);const o={progress:0,alpha:0,palette:e.palette??z(void 0),bandTight:e.bandTight??14,direction:e.direction??"ltr",waveAmount:e.waveAmount??1,rippleAmount:e.rippleAmount??1,waveSpeed:e.waveSpeed??1,brightness:e.brightness??1,swellAmount:e.swellAmount??.55},V=Math.random()*.4,k=()=>{const i=Math.min(window.devicePixelRatio||1,2),b=a.getBoundingClientRect(),g=Math.max(1,Math.round(b.width*i)),B=Math.max(1,Math.round(b.height*i));(a.width!==g||a.height!==B)&&(a.width=g,a.height=B,t.viewport(0,0,g,B))};k();const C=new ResizeObserver(k);C.observe(a);const X=performance.now();let x=0;const O=()=>{const i=(performance.now()-X)/1e3,b=Z(o.direction);t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.uniform2f(u,a.width,a.height),t.uniform1f(p,i),t.uniform1f(A,o.progress),t.uniform1f(h,o.alpha),t.uniform1f(v,o.bandTight),t.uniform1f(P,b.posStart),t.uniform1f(S,b.posEnd),t.uniform1f(M,b.axis),t.uniform1f(f,o.waveAmount),t.uniform1f(y,o.rippleAmount),t.uniform1f(F,o.waveSpeed),t.uniform1f(E,o.brightness),t.uniform1f(T,o.swellAmount),t.uniform1f(w,V),t.uniform3f(H,o.palette.a[0],o.palette.a[1],o.palette.a[2]),t.uniform3f(W,o.palette.b[0],o.palette.b[1],o.palette.b[2]),t.uniform3f(q,o.palette.c[0],o.palette.c[1],o.palette.c[2]),t.uniform3f(U,o.palette.d[0],o.palette.d[1],o.palette.d[2]),t.drawArrays(t.TRIANGLE_STRIP,0,4),x=requestAnimationFrame(O)};return x=requestAnimationFrame(O),{canvas:a,setProgress:i=>{o.progress=i},setAlpha:i=>{o.alpha=i},setPalette:i=>{o.palette=i},setBandTight:i=>{o.bandTight=i},setDirection:i=>{o.direction=i},setWaveAmount:i=>{o.waveAmount=i},setRippleAmount:i=>{o.rippleAmount=i},setWaveSpeed:i=>{o.waveSpeed=i},setBrightness:i=>{o.brightness=i},setSwellAmount:i=>{o.swellAmount=i},getProgress:()=>o.progress,getAlpha:()=>o.alpha,destroy:()=>{cancelAnimationFrame(x),C.disconnect(),t.deleteProgram(l),t.deleteBuffer(n),t.deleteShader(d),t.deleteShader(m)}}}function D(e,a,t,c){const d=n=>3*(1-n)*(1-n)*n*e+3*(1-n)*n*n*t+n*n*n,m=n=>3*(1-n)*(1-n)*n*a+3*(1-n)*n*n*c+n*n*n,l=n=>3*(1-4*n+3*n*n)*e+3*(2*n-3*n*n)*t+3*n*n;return n=>{if(n<=0)return 0;if(n>=1)return 1;let s=n;for(let r=0;r<8;r++){const u=d(s)-n;if(Math.abs(u)<1e-6)break;const p=l(s);if(Math.abs(p)<1e-6)break;s-=u/p}return m(s)}}var I={linear:e=>e,easeOutQuart:e=>1-Math.pow(1-e,4),easeOutCubic:e=>1-Math.pow(1-e,3),easeInCubic:e=>e*e*e,easeInOutCubic:e=>e<.5?4*e*e*e:1-Math.pow(-2*e+2,3)/2,easeOutExpo:e=>e===1?1:1-Math.pow(2,-10*e),easeInOutQuint:e=>e<.5?16*e*e*e*e*e:1-Math.pow(-2*e+2,5)/2,snap:D(1,0,.35,.95),ease:D(.25,.1,.25,1),back:D(.175,.885,.32,1.1)},ee=e=>e?typeof e=="function"?e:I[e]:I.easeOutQuart,te=e=>1-Math.pow(1-e,4),ae=e=>e<.5?4*e*e*e:1-Math.pow(-2*e+2,3)/2;function L(e,a={}){const t=a.sweepMs??1100,c=a.outroMs??700,d=a.midpoint??.5,m=ee(a.easing)??te,l=a.peakAlpha??1;a.palette&&e.setPalette(z(a.palette)),a.bandTight!==void 0&&e.setBandTight(a.bandTight),a.direction&&e.setDirection(a.direction),a.waveAmount!==void 0&&e.setWaveAmount(a.waveAmount),a.rippleAmount!==void 0&&e.setRippleAmount(a.rippleAmount),a.waveSpeed!==void 0&&e.setWaveSpeed(a.waveSpeed),a.brightness!==void 0&&e.setBrightness(a.brightness),a.swellAmount!==void 0&&e.setSwellAmount(a.swellAmount);let n=!1,s=0,r,u;const p=new Promise(h=>{r=h}),A=new Promise(h=>{u=h});return(async()=>{const h=e.getProgress(),v=h>=.999?0:Math.max(0,Math.min(1,h));e.setAlpha(l),e.setProgress(v);const P=1-v,S=Math.max(80,t*P);let w=!1;const M=performance.now();await new Promise(f=>{const y=()=>{if(n){f();return}const F=Math.min(1,(performance.now()-M)/S),E=m(F),T=v+P*E;e.setProgress(T),!w&&T>=d&&(w=!0,Promise.resolve(a.onMidpoint?.()).finally(r)),F<1?s=requestAnimationFrame(y):f()};s=requestAnimationFrame(y)}),!n&&(w||Promise.resolve(a.onMidpoint?.()).finally(r),await ne(c,l,0,ae,e.setAlpha,()=>n,f=>{s=f}),!n&&(e.setProgress(0),a.onComplete?.(),u()))})(),{midpoint:p,done:A,cancel:()=>{n=!0,cancelAnimationFrame(s),r(),u()}}}function ne(e,a,t,c,d,m,l){return new Promise(n=>{const s=performance.now(),r=()=>{if(m()){n();return}const u=Math.min(1,(performance.now()-s)/e);d(a+(t-a)*c(u)),u<1?l(requestAnimationFrame(r)):n()};l(requestAnimationFrame(r))})}const N=document.getElementById("glimm-page-transition"),oe=window.matchMedia("(prefers-reduced-motion: reduce)");if(N&&!window.__glimmPageTransitionInstalled){window.__glimmPageTransitionInstalled=!0;const e=$({canvas:N,direction:"ltr",brightness:.92,waveAmount:.85,rippleAmount:.8,swellAmount:.75});if(e){const a=["ltr","rtl","ttb","btt"],t=["lagoon","azure","berry","citrus","prism"];let n,s=0,r=0,u=!1,p="ltr",A="lagoon";document.addEventListener("astro:before-preparation",h=>{if(oe.matches)return;const v=h;n?.cancel();const P=++r,S=a[s%a.length],w=t[s%t.length];s+=1,p=S,A=w,u=!0;const M=v.loader;v.loader=async()=>{const f=L(e,{direction:S,palette:w,sweepMs:420,midpoint:.5,peakAlpha:.96,bandTight:4.8,easing:"easeOutQuart"});n=f;const y=M();try{await f.midpoint,f.cancel(),await y}catch(F){throw P===r&&(u=!1,e.setAlpha(0),e.setProgress(0)),F}}}),document.addEventListener("astro:after-swap",()=>{u&&(u=!1,n=L(e,{direction:p,palette:A,sweepMs:420,outroMs:460,peakAlpha:.96,bandTight:4.8,easing:"easeOutQuart"}))})}}
