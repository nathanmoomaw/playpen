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
  if (r < 0.18) return Math.floor(Math.random() * 20)
  if (r < 0.30) return Math.floor(Math.random() * 20 + 50)
  return Math.floor(Math.random() * 30 + 22)
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

function Knob({ label, value, onChange, min = 0, max = 2 }) {
  const drag = useRef(null)
  const SIZE = 64, R = 24, CX = 32, CY = 32

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const startDeg = -135
  const valueDeg = startDeg + norm * 270

  function polarXY(deg) {
    const rad = ((deg - 90) * Math.PI) / 180
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)]
  }

  function arc(a, b) {
    const [sx, sy] = polarXY(a)
    const [ex, ey] = polarXY(b)
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
  }

  function onPointerDown(e) {
    drag.current = { startY: e.clientY, startValue: value }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }
  function onPointerMove(e) {
    if (!drag.current) return
    const dy = drag.current.startY - e.clientY
    onChange(Math.max(min, Math.min(max, drag.current.startValue + (dy / 80) * (max - min))))
  }
  function onPointerUp() { drag.current = null }

  const [dotX, dotY] = polarXY(valueDeg)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, userSelect: 'none' }}>
      <svg
        width={SIZE} height={SIZE}
        style={{ cursor: 'ns-resize', filter: 'drop-shadow(0 0 8px rgba(0,220,140,0.55)) drop-shadow(0 0 2px rgba(0,220,140,0.9))' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <circle cx={CX} cy={CY} r={R + 3} fill="rgba(0,20,12,0.85)" stroke="rgba(0,80,50,0.4)" strokeWidth={1} />
        <path d={arc(-135, 135)} fill="none" stroke="rgba(0,100,60,0.3)" strokeWidth={4} strokeLinecap="round" />
        {norm > 0.005 && (
          <path d={arc(-135, valueDeg)} fill="none" stroke="#00e896" strokeWidth={4} strokeLinecap="round" />
        )}
        <circle cx={CX} cy={CY} r={11} fill="rgba(0,30,20,0.9)" stroke="rgba(0,150,80,0.3)" strokeWidth={1} />
        <circle cx={dotX} cy={dotY} r={3.5} fill="#00e896" />
        <text x={CX} y={CY + 4} textAnchor="middle" fill="rgba(0,220,140,0.85)" fontSize={9} fontFamily="'Courier New', monospace">{value.toFixed(1)}</text>
      </svg>
      <span style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 9, letterSpacing: '0.12em',
        color: 'rgba(120, 200, 140, 0.6)',
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  )
}

export default function AsciiThree() {
  const mountRef   = useRef(null)
  const overlayRef = useRef(null)
  const bgRef      = useRef(null)
  const stateRef   = useRef({ particles: [], mesh: null, lights: null, solidMat: null, wireMat: null })
  const brightRef  = useRef({ bg: 1, shapes: 1, text: 1, size: 1.5 })

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

    stateRef.current.zoomIn  = () => { camera.position.multiplyScalar(0.85); controls.update() }
    stateRef.current.zoomOut = () => { camera.position.multiplyScalar(1.18); controls.update() }

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

    const _euler   = new THREE.Euler()
    const _target  = new THREE.Vector3()
    const _spring  = new THREE.Vector3()
    const _viewVec = new THREE.Vector3()

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

    // Text cursor state — shared across transitionParticles & spawnTyped
    let typedStart      = null
    let typedAxis       = null
    let typedSpiralAxis = null
    let typedCharAngle  = 0
    let typedCount      = 0
    const CHAR_SPACING  = 0.40
    // Shifts text one char-width laterally per full revolution → spiral, no overlap
    const SPIRAL_PITCH  = CHAR_SPACING / (2 * Math.PI)

    // Projection mesh — un-rotated copy used to snap typed chars back onto the surface
    let projMesh   = null
    const projCast = new THREE.Raycaster()

    function initProjMesh(idx) {
      if (projMesh) { projMesh.geometry.dispose(); projMesh.material.dispose() }
      projMesh = new THREE.Mesh(
        SHAPES[idx].geo(),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      )
    }

    function projectOnShape(pt) {
      if (!projMesh) return pt
      const dir = pt.clone().normalize()
      // Ray from far outside, aimed at origin — hits the shape's outer surface
      projCast.set(dir.clone().multiplyScalar(20), dir.negate())
      const hits = projCast.intersectObject(projMesh)
      return hits.length > 0 ? hits[0].point.clone() : pt
    }

    function makeTypedAxes(anchor) {
      const radial = anchor.clone().normalize()
      const arbitrary = Math.abs(radial.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0)
      typedAxis = new THREE.Vector3().crossVectors(radial, arbitrary).normalize()
      typedSpiralAxis = new THREE.Vector3().crossVectors(typedAxis, radial).normalize()
      typedCharAngle = CHAR_SPACING / Math.max(0.5, anchor.length())
    }

    function typedBase(n) {
      const angle = n * typedCharAngle
      const raw = typedStart.clone()
        .applyAxisAngle(typedAxis, angle)
        .addScaledVector(typedSpiralAxis, angle * SPIRAL_PITCH)
      return projectOnShape(raw)
    }

    function reanchorTyped(pos, vn, idx) {
      const typedParticles = stateRef.current.particles
        .filter(p => p.isTyped)
        .sort((a, b) => a.typeIndex - b.typeIndex)
      if (typedParticles.length === 0) return

      initProjMesh(idx)
      const i = Math.floor(Math.random() * vn)
      typedStart = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
      makeTypedAxes(typedStart)

      typedParticles.forEach((p, n) => {
        p.base = typedBase(n)
        p.typeIndex = n
      })
      typedCount = typedParticles.length
    }

    function transitionParticles(idx) {
      const geo = SHAPES[idx].geo()
      const pos = geo.attributes.position
      const vn  = pos.count
      stateRef.current.particles.forEach(p => {
        if (p.isTyped) return
        const i = Math.floor(Math.random() * vn)
        p.base.set(
          pos.getX(i) + (Math.random() - 0.5) * 0.15,
          pos.getY(i) + (Math.random() - 0.5) * 0.15,
          pos.getZ(i) + (Math.random() - 0.5) * 0.15,
        )
      })
      reanchorTyped(pos, vn, idx)
      geo.dispose()
    }

    function buildShape(idx, isFirst = false) {
      makeMesh(idx)
      if (isFirst) initParticles(idx)
      else transitionParticles(idx)
    }

    stateRef.current.currentShapeIdx = 0
    buildShape(0, true)
    stateRef.current.switchShape = (idx) => {
      stateRef.current.currentShapeIdx = idx
      buildShape(idx, false)
    }

    function spawnTyped(char) {
      const idx = stateRef.current.currentShapeIdx

      if (typedCount === 0) {
        const geo = SHAPES[idx].geo()
        const pos = geo.attributes.position
        const i   = Math.floor(Math.random() * pos.count)
        typedStart = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
        geo.dispose()
        initProjMesh(idx)
        makeTypedAxes(typedStart)
      }

      const base = typedBase(typedCount)

      stateRef.current.particles.push({
        base,
        pos:   base.clone(),
        vel:   new THREE.Vector3(),
        char,
        phase: Math.random() * Math.PI * 2,
        freq:  0.2 + Math.random() * 0.3,
        amp:   0.015 + Math.random() * 0.02,
        hue: 55, sat: 10, lit: 96,
        isTyped:   true,
        typeIndex: typedCount,
      })
      typedCount++
    }

    const onKeyDown = (e) => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        const ps = stateRef.current.particles
        for (let i = ps.length - 1; i >= 0; i--) {
          if (ps[i].isTyped) { ps.splice(i, 1); typedCount = Math.max(0, typedCount - 1); break }
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        spawnTyped(e.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    let wasDragging = false
    const onDown = () => { wasDragging = false }
    const onMove = () => { wasDragging = true }
    const onUp   = () => {
      if (wasDragging) return
      const geo = SHAPES[stateRef.current.currentShapeIdx].geo()
      const pos = geo.attributes.position
      const vn  = pos.count
      stateRef.current.particles.forEach(p => {
        const dir = p.pos.clone()
        if (dir.lengthSq() < 0.001)
          dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        dir.normalize().multiplyScalar(1.8 + Math.random() * 2.2)
        p.vel.add(dir)
        if (p.isTyped) {
          // Scramble typed char to a random surface position
          const i = Math.floor(Math.random() * vn)
          p.base.set(pos.getX(i), pos.getY(i), pos.getZ(i))
        }
      })
      geo.dispose()
      // Reset cursor — next typing starts a fresh spiral sequence
      typedStart = null; typedAxis = null; typedSpiralAxis = null; typedCharAngle = 0; typedCount = 0
      if (projMesh) { projMesh.geometry.dispose(); projMesh.material.dispose(); projMesh = null }
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    renderer.domElement.addEventListener('mousemove', onMove)
    renderer.domElement.addEventListener('mouseup',   onUp)

    function project(p, camDist) {
      _viewVec.copy(p.pos).applyMatrix4(camera.matrixWorldInverse)
      const viewDist = -_viewVec.z
      const depth = Math.max(0, Math.min(1, 1 - (viewDist - (camDist - 3.5)) / 7))
      const sv = p.pos.clone().project(camera)
      return { x: (sv.x * 0.5 + 0.5) * W, y: (-sv.y * 0.5 + 0.5) * H, z: sv.z, depth }
    }

    let t = 0, raf

    function animate() {
      raf = requestAnimationFrame(animate)
      t += 0.016

      const { mesh, particles, lights, solidMat, wireMat } = stateRef.current
      const { shapes: sb, text: tb, size: sz } = brightRef.current

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

      ctx.clearRect(0, 0, W, H)
      const camDist = camera.position.length()
      const sorted = particles
        .map(p => ({ p, sc: project(p, camDist) }))
        .filter(({ sc }) => sc.z > -1 && sc.z < 1)
        .sort((a, b) => b.sc.depth - a.sc.depth)

      ctx.shadowBlur = 0
      for (const { p, sc } of sorted) {
        const depth = sc.depth
        const alpha = depth * 0.88 + 0.12
        const size  = Math.max(6, Math.floor(depth * 22 * sz))

        if (p.isTyped) {
          const litVal = Math.min(100, p.lit * tb)
          ctx.font        = `bold ${size}px 'Courier New', monospace`
          ctx.shadowColor = `rgba(255,250,220,0.95)`
          ctx.shadowBlur  = size * 2.2
          ctx.fillStyle   = `hsla(55,10%,${litVal}%,${(alpha * 1.1).toFixed(2)})`
        } else {
          const adjustedL = Math.min(100, p.lit * tb)
          ctx.font = `${size}px 'Courier New', monospace`
          if (depth > 0.55) {
            ctx.shadowColor = `hsla(${p.hue},${p.sat}%,${adjustedL}%,0.7)`
            ctx.shadowBlur  = size * 1.4
          } else {
            ctx.shadowBlur = 0
          }
          ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${adjustedL}%,${alpha.toFixed(2)})`
        }
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
      window.removeEventListener('keydown', onKeyDown)
      renderer.domElement.removeEventListener('mousedown', onDown)
      renderer.domElement.removeEventListener('mousemove', onMove)
      renderer.domElement.removeEventListener('mouseup',   onUp)
      if (projMesh) { projMesh.geometry.dispose(); projMesh.material.dispose() }
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

      <div
        ref={bgRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse at 40% 50%, #09244e 0%, #06122a 60%, #030c18 100%)',
        }}
      />

      <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />

      <div style={{
        position: 'absolute', top: 28, left: 32, zIndex: 10,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(0, 220, 140, 0.55)',
        fontSize: 13, letterSpacing: '0.2em',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        ASCII ↔ THREE.JS
      </div>

      <div style={{
        position: 'absolute', top: 28, right: 32, zIndex: 10,
        fontFamily: "'Courier New', monospace",
        color: 'rgba(0, 200, 120, 0.35)',
        fontSize: 11, textAlign: 'right', lineHeight: 1.9,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        drag to orbit<br />
        scroll to zoom<br />
        click to explode<br />
        type to add text<br />
        ⌫ to remove
      </div>

      {/* Knobs */}
      <div style={{
        position: 'absolute', left: 28, top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 18, zIndex: 10,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(0,220,140,0.12)',
        borderRadius: 8, padding: '18px 14px',
      }}>
        <Knob label="bg"     value={bright.bg}     onChange={v => setBrightKey('bg', v)} />
        <Knob label="shapes" value={bright.shapes}  onChange={v => setBrightKey('shapes', v)} />
        <Knob label="text"   value={bright.text}    onChange={v => setBrightKey('text', v)} />
        <Knob label="size"   value={bright.size}    onChange={v => setBrightKey('size', v)} max={3} />
      </div>

      {/* Zoom buttons */}
      <div style={{
        position: 'absolute', right: 28, bottom: 80,
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
      }}>
        {[{ sym: '+', fn: 'zoomIn' }, { sym: '−', fn: 'zoomOut' }].map(({ sym, fn }) => (
          <button
            key={sym}
            tabIndex={-1}
            onClick={() => stateRef.current[fn]?.()}
            style={{
              width: 36, height: 36,
              background: 'rgba(0,200,120,0.08)',
              border: '1px solid rgba(0,200,120,0.3)',
              color: 'rgba(0,220,140,0.8)',
              borderRadius: 4, cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              fontSize: 20, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {sym}
          </button>
        ))}
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
            tabIndex={-1}
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
