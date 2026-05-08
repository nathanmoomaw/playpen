import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const CHARS = '@#%&*/\\|+-=~^<>()[]{}!?;:ABCDEFabcdef0123456789'

const SHAPES = [
  { name: 'sphere',  geo: () => new THREE.SphereGeometry(2, 32, 32) },
  { name: 'torus',   geo: () => new THREE.TorusGeometry(2, 0.7, 20, 80) },
  { name: 'cube',    geo: () => new THREE.BoxGeometry(3, 3, 3, 6, 6, 6) },
  { name: 'knot',    geo: () => new THREE.TorusKnotGeometry(1.5, 0.5, 128, 16) },
  { name: 'icosa',   geo: () => new THREE.IcosahedronGeometry(2.2, 3) },
]

const N = 280

// Warm amber/gold palette — distinct from blue bg and teal shapes
function randomHue() {
  const r = Math.random()
  if (r < 0.18) return Math.floor(Math.random() * 20)           // red-orange accent
  if (r < 0.30) return Math.floor(Math.random() * 20 + 50)      // yellow-green accent
  return Math.floor(Math.random() * 30 + 22)                    // amber/gold dominant
}

function sampleGeo(geo, count) {
  const pos = geo.attributes.position
  const n = pos.count
  return Array.from({ length: count }, () => {
    const i = Math.floor(Math.random() * n)
    return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
  })
}

const SOLID_OPACITY_BASE = 0.2
const WIRE_OPACITY_BASE  = 0.45

function Slider({ label, value, onChange, max = 2 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
      <span style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 10, letterSpacing: '0.12em',
        color: 'rgba(120, 200, 140, 0.6)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <input
        type="range" min="0" max={max} step="0.01"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 100, accentColor: '#00cc88', cursor: 'pointer' }}
      />
    </label>
  )
}

export default function AsciiThree() {
  const mountRef    = useRef(null)
  const overlayRef  = useRef(null)
  const bgRef       = useRef(null)
  const stateRef    = useRef({ particles: [], mesh: null, lights: null, solidMat: null, wireMat: null })
  const brightRef   = useRef({ bg: 1, shapes: 1, text: 1, size: 1.5 })

  const [active, setActive] = useState(0)
  const [bright, setBright] = useState({ bg: 1, shapes: 1, text: 1, size: 1.5 })

  function setBrightKey(key, val) {
    brightRef.current[key] = val
    setBright(prev => ({ ...prev, [key]: val }))
    if (key === 'bg' && bgRef.current) {
      bgRef.current.style.filter = `brightness(${val})`
    }
  }

  useEffect(() => {
    const mount   = mountRef.current
    const overlay = overlayRef.current
    let W = mount.clientWidth
    let H = mount.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100)
    camera.position.z = 8
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Lights — stored for brightness control
    const ambient = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambient)
    const dl1 = new THREE.DirectionalLight(0x44ddaa, 1.4)
    dl1.position.set(5, 8, 5)
    scene.add(dl1)
    const dl2 = new THREE.DirectionalLight(0xff8833, 0.5)
    dl2.position.set(-6, -4, -5)
    scene.add(dl2)
    stateRef.current.lights = { ambient, dl1, dl2 }

    overlay.width = W
    overlay.height = H
    const ctx = overlay.getContext('2d')

    const _euler  = new THREE.Euler()
    const _target = new THREE.Vector3()
    const _spring = new THREE.Vector3()

    function makeMesh(idx) {
      const s = stateRef.current
      if (s.mesh) {
        scene.remove(s.mesh)
        s.mesh.traverse(c => {
          if (c.geometry) c.geometry.dispose()
          if (c.material) c.material.dispose()
        })
      }
      const geo      = SHAPES[idx].geo()
      const solidMat = new THREE.MeshPhongMaterial({
        color: 0x02200f, transparent: true,
        opacity: SOLID_OPACITY_BASE, shininess: 120, specular: 0x00cc88,
      })
      const wireMat  = new THREE.MeshBasicMaterial({
        color: 0x00e896, wireframe: true, transparent: true,
        opacity: WIRE_OPACITY_BASE,
      })
      const group = new THREE.Group()
      group.add(new THREE.Mesh(geo, solidMat))
      group.add(new THREE.Mesh(geo.clone(), wireMat))
      scene.add(group)
      s.mesh      = group
      s.solidMat  = solidMat
      s.wireMat   = wireMat
    }

    function initParticles(idx) {
      const geo = SHAPES[idx].geo()
      const pts = sampleGeo(geo, N)
      geo.dispose()
      stateRef.current.particles = pts.map(base => ({
        base: base.clone(),
        pos:  base.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
        )),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06,
        ),
        char:  CHARS[Math.floor(Math.random() * CHARS.length)],
        phase: Math.random() * Math.PI * 2,
        freq:  0.6 + Math.random() * 2,
        amp:   0.06 + Math.random() * 0.14,
        hue:   randomHue(),
        sat:   70 + Math.floor(Math.random() * 25),
        lit:   62 + Math.floor(Math.random() * 25),
      }))
    }

    function transitionParticles(idx) {
      const geo = SHAPES[idx].geo()
      const pos = geo.attributes.position
      const vn  = pos.count
      stateRef.current.particles.forEach(p => {
        const i = Math.floor(Math.random() * vn)
        p.base.set(
          pos.getX(i) + (Math.random() - 0.5) * 0.15,
          pos.getY(i) + (Math.random() - 0.5) * 0.15,
          pos.getZ(i) + (Math.random() - 0.5) * 0.15,
        )
      })
      geo.dispose()
    }

    function buildShape(idx, isFirst = false) {
      makeMesh(idx)
      if (isFirst) initParticles(idx)
      else transitionParticles(idx)
    }

    buildShape(0, true)
    stateRef.current.switchShape = (idx) => buildShape(idx, false)

    let wasDragging = false
    const onDown = () => { wasDragging = false }
    const onMove = () => { wasDragging = true }
    const onUp   = () => {
      if (wasDragging) return
      stateRef.current.particles.forEach(p => {
        const dir = p.pos.clone()
        if (dir.lengthSq() < 0.001)
          dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        dir.normalize().multiplyScalar(1.8 + Math.random() * 2.2)
        p.vel.add(dir)
      })
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    renderer.domElement.addEventListener('mousemove', onMove)
    renderer.domElement.addEventListener('mouseup',   onUp)

    function project(p) {
      const v = p.pos.clone().project(camera)
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z }
    }

    let t = 0, raf

    function animate() {
      raf = requestAnimationFrame(animate)
      t += 0.016

      const { mesh, particles, lights, solidMat, wireMat } = stateRef.current
      const { shapes: sb, text: tb, size: sz } = brightRef.current

      // Shape brightness — lights + material opacity
      if (lights) {
        lights.ambient.intensity = 0.3  * sb
        lights.dl1.intensity     = 1.4  * sb
        lights.dl2.intensity     = 0.5  * sb
      }
      if (solidMat) solidMat.opacity = Math.min(1, SOLID_OPACITY_BASE * sb)
      if (wireMat)  wireMat.opacity  = Math.min(1, WIRE_OPACITY_BASE  * sb)

      if (mesh) {
        mesh.rotation.y = t * 0.25
        mesh.rotation.x = Math.sin(t * 0.11) * 0.38
        _euler.set(mesh.rotation.x, mesh.rotation.y, 0)
      }

      for (const p of particles) {
        _target.copy(p.base).applyEuler(_euler)
        _target.x += Math.sin(t * p.freq + p.phase) * p.amp
        _target.y += Math.cos(t * p.freq * 0.73 + p.phase) * p.amp
        _target.z += Math.sin(t * p.freq * 1.17 + p.phase + 1.3) * p.amp
        _spring.copy(_target).sub(p.pos).multiplyScalar(0.055)
        p.vel.add(_spring)
        p.vel.multiplyScalar(0.91)
        p.pos.add(p.vel)
      }

      controls.update()
      renderer.render(scene, camera)

      // ASCII overlay
      ctx.clearRect(0, 0, W, H)
      const sorted = particles
        .map(p => ({ p, sc: project(p) }))
        .filter(({ sc }) => sc.z > -1 && sc.z < 1)
        .sort((a, b) => b.sc.z - a.sc.z)

      ctx.shadowBlur = 0
      for (const { p, sc } of sorted) {
        const depth      = Math.max(0, Math.min(1, (1 - sc.z) / 2))
        const alpha      = depth * 0.88 + 0.12
        const size       = Math.max(6, Math.floor(depth * 22 * sz))
        const adjustedL  = Math.min(100, p.lit * tb)
        ctx.font = `${size}px 'Courier New', monospace`
        if (depth > 0.55) {
          ctx.shadowColor = `hsla(${p.hue},${p.sat}%,${adjustedL}%,0.7)`
          ctx.shadowBlur  = size * 1.4
        } else {
          ctx.shadowBlur = 0
        }
        ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${adjustedL}%,${alpha.toFixed(2)})`
        ctx.fillText(p.char, sc.x, sc.y)
      }
      ctx.shadowBlur = 0
    }

    animate()

    const onResize = () => {
      W = mount.clientWidth
      H = mount.clientHeight
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
      overlay.width = W
      overlay.height = H
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('mousedown', onDown)
      renderer.domElement.removeEventListener('mousemove', onMove)
      renderer.domElement.removeEventListener('mouseup',   onUp)
      controls.dispose()
      scene.traverse(c => {
        if (c.geometry) c.geometry.dispose()
        if (c.material) c.material.dispose()
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* Background — isolated so brightness filter doesn't bleed onto canvas */}
      <div
        ref={bgRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse at 40% 50%, #09244e 0%, #06122a 60%, #030c18 100%)',
        }}
      />

      <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />

      {/* Title */}
      <div style={{
        position: 'absolute', top: 28, left: 32, zIndex: 10,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(0, 220, 140, 0.55)',
        fontSize: 13, letterSpacing: '0.2em',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        ASCII ↔ THREE.JS
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute', top: 28, right: 32, zIndex: 10,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(0, 200, 120, 0.35)',
        fontSize: 11, textAlign: 'right', lineHeight: 1.9,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        drag to orbit<br />
        scroll to zoom<br />
        click to explode
      </div>

      {/* Brightness sliders */}
      <div style={{
        position: 'absolute', left: 28, top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(0,220,140,0.12)',
        borderRadius: 6, padding: '16px 14px',
      }}>
        <Slider label="bg"     value={bright.bg}     onChange={v => setBrightKey('bg', v)} />
        <Slider label="shapes" value={bright.shapes}  onChange={v => setBrightKey('shapes', v)} />
        <Slider label="text"   value={bright.text}    onChange={v => setBrightKey('text', v)} />
        <Slider label="size"   value={bright.size}    onChange={v => setBrightKey('size', v)} max={3} />
      </div>

      {/* Shape buttons */}
      <div style={{
        position: 'absolute', bottom: 32, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', gap: 8, zIndex: 10,
      }}>
        {SHAPES.map((s, i) => (
          <button
            key={s.name}
            onClick={() => {
              stateRef.current.switchShape(i)
              setActive(i)
            }}
            style={{
              background: active === i ? 'rgba(0, 200, 120, 0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active === i ? 'rgba(0,200,120,0.6)' : 'rgba(255,255,255,0.1)'}`,
              color: active === i ? '#00e896' : 'rgba(180,220,200,0.45)',
              padding: '5px 16px', borderRadius: 3, cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              fontSize: 12, letterSpacing: '0.12em', transition: 'all 0.2s',
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
