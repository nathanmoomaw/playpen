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

function randomHue() {
  const r = Math.random()
  if (r < 0.07) return Math.floor(Math.random() * 40 + 20)   // warm accent
  if (r < 0.22) return Math.floor(Math.random() * 40 + 260)  // purple
  return Math.floor(Math.random() * 60 + 180)                 // blue-cyan
}

function sampleGeo(geo, count) {
  const pos = geo.attributes.position
  const n = pos.count
  return Array.from({ length: count }, () => {
    const i = Math.floor(Math.random() * n)
    return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
  })
}

export default function AsciiThree() {
  const mountRef = useRef(null)
  const overlayRef = useRef(null)
  const stateRef = useRef({ particles: [], mesh: null })
  const [active, setActive] = useState(0)

  useEffect(() => {
    const mount = mountRef.current
    const overlay = overlayRef.current
    let W = mount.clientWidth
    let H = mount.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // Scene / camera / controls
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100)
    camera.position.z = 8
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3))
    const dl1 = new THREE.DirectionalLight(0x6699ff, 1.4)
    dl1.position.set(5, 8, 5)
    scene.add(dl1)
    const dl2 = new THREE.DirectionalLight(0xff5533, 0.6)
    dl2.position.set(-6, -4, -5)
    scene.add(dl2)

    // 2D overlay
    overlay.width = W
    overlay.height = H
    const ctx = overlay.getContext('2d')

    // Reusable vectors for hot path
    const _euler = new THREE.Euler()
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
      const geo = SHAPES[idx].geo()
      const group = new THREE.Group()
      group.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: 0x081422, transparent: true, opacity: 0.18,
        shininess: 100, specular: 0x2255aa,
      })))
      group.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
        color: 0x1a3355, wireframe: true, transparent: true, opacity: 0.22,
      })))
      scene.add(group)
      s.mesh = group
    }

    function initParticles(idx) {
      const geo = SHAPES[idx].geo()
      const pts = sampleGeo(geo, N)
      geo.dispose()
      stateRef.current.particles = pts.map(base => ({
        base: base.clone(),
        pos: base.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
        )),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06,
        ),
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        phase: Math.random() * Math.PI * 2,
        freq: 0.6 + Math.random() * 2,
        amp: 0.06 + Math.random() * 0.14,
        hue: randomHue(),
        sat: 60 + Math.floor(Math.random() * 35),
        lit: 62 + Math.floor(Math.random() * 28),
      }))
    }

    function transitionParticles(idx) {
      const geo = SHAPES[idx].geo()
      const pos = geo.attributes.position
      const vn = pos.count
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

    // Click-to-explode (ignore drags)
    let wasDragging = false
    const onDown = () => { wasDragging = false }
    const onMove = () => { wasDragging = true }
    const onUp = () => {
      if (wasDragging) return
      stateRef.current.particles.forEach(p => {
        const dir = p.pos.clone()
        if (dir.lengthSq() < 0.001) dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        dir.normalize().multiplyScalar(1.8 + Math.random() * 2.2)
        p.vel.add(dir)
      })
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    renderer.domElement.addEventListener('mousemove', onMove)
    renderer.domElement.addEventListener('mouseup', onUp)

    function project(p) {
      const v = p.pos.clone().project(camera)
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z }
    }

    let t = 0
    let raf

    function animate() {
      raf = requestAnimationFrame(animate)
      t += 0.016

      const { mesh, particles } = stateRef.current
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
        const depth = Math.max(0, Math.min(1, (1 - sc.z) / 2))
        const alpha = depth * 0.88 + 0.12
        const size = Math.max(7, Math.floor(depth * 15))
        ctx.font = `${size}px 'Courier New', monospace`
        if (depth > 0.55) {
          ctx.shadowColor = `hsla(${p.hue},${p.sat}%,${p.lit}%,0.7)`
          ctx.shadowBlur = size * 1.4
        } else {
          ctx.shadowBlur = 0
        }
        ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${p.lit}%,${alpha.toFixed(2)})`
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
      renderer.domElement.removeEventListener('mouseup', onUp)
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
    <div style={{
      width: '100vw', height: '100vh',
      background: 'radial-gradient(ellipse at 40% 50%, #09244e 0%, #06122a 60%, #030c18 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div style={{
        position: 'absolute', top: 28, left: 32,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(80, 160, 255, 0.55)',
        fontSize: 13, letterSpacing: '0.2em',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        ASCII ↔ THREE.JS
      </div>

      <div style={{
        position: 'absolute', top: 28, right: 32,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(80, 160, 255, 0.35)',
        fontSize: 11, textAlign: 'right', lineHeight: 1.9,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        drag to orbit<br />
        scroll to zoom<br />
        click to explode
      </div>

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
              background: active === i ? 'rgba(40, 120, 255, 0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active === i ? 'rgba(60,150,255,0.65)' : 'rgba(255,255,255,0.1)'}`,
              color: active === i ? '#7ab8ff' : 'rgba(180,210,255,0.45)',
              padding: '5px 16px',
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              fontSize: 12, letterSpacing: '0.12em',
              transition: 'all 0.2s',
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
