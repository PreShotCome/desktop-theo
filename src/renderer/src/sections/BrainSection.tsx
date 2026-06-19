import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { brain, type BrainNode } from '../data/brain'

interface Selected {
  kind: 'node' | 'hub'
  category: string
  color: string
  label: string
  body?: string
  count?: number
}

// Deterministic RNG so the layout is stable between launches.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Even point distribution on a sphere — used to place the 40 category hubs.
function fibSphere(i: number, n: number, r: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(phi)
  ).multiplyScalar(r)
}

// Soft radial sprite used as a cheap, reliable "glow" around each node.
function makeGlowTexture(): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function BrainSection(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Selected | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const teal = new THREE.Color('#36e0c8')
    const violet = new THREE.Color('#8b5cf6')
    const glowTex = makeGlowTexture()

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000)
    camera.position.set(0, 14, 185)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 70
    controls.maxDistance = 360
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45

    const root = new THREE.Group()
    scene.add(root)

    const clickable: THREE.Mesh[] = []
    const edgePts: number[] = []
    const edgeCols: number[] = []
    const sphereGeo = new THREE.SphereGeometry(1, 16, 16)
    const cats = brain.categories
    const N = cats.length

    function addGlow(pos: THREE.Vector3, color: THREE.Color, size: number): void {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.9
      })
      const s = new THREE.Sprite(mat)
      s.position.copy(pos)
      s.scale.setScalar(size)
      root.add(s)
    }

    // Core
    const coreColor = new THREE.Color('#bfe9ff')
    const core = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: coreColor }))
    core.scale.setScalar(3.4)
    root.add(core)
    addGlow(new THREE.Vector3(0, 0, 0), coreColor, 26)

    cats.forEach((cat, i) => {
      const t = N > 1 ? i / (N - 1) : 0
      const color = teal.clone().lerp(violet, t)
      const hub = fibSphere(i, N, 62)
      const rng = mulberry32(i * 9173 + 7)

      // hub
      const hubMesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color }))
      hubMesh.position.copy(hub)
      hubMesh.scale.setScalar(2.0)
      hubMesh.userData = {
        kind: 'hub',
        category: cat.label,
        color: '#' + color.getHexString(),
        label: cat.label,
        count: cat.nodes.length
      }
      root.add(hubMesh)
      clickable.push(hubMesh)
      addGlow(hub, color, 14)

      // edge core -> hub
      edgePts.push(0, 0, 0, hub.x, hub.y, hub.z)
      edgeCols.push(coreColor.r, coreColor.g, coreColor.b, color.r, color.g, color.b)

      // nodes around the hub
      const spread = 9 + Math.min(cat.nodes.length, 12) * 1.6
      cat.nodes.forEach((node: BrainNode) => {
        const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
        const dist = spread * (0.45 + rng() * 0.75)
        const p = hub.clone().add(dir.multiplyScalar(dist))
        const nodeColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.18 + rng() * 0.2)

        const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: nodeColor }))
        m.position.copy(p)
        m.scale.setScalar(1.15)
        m.userData = {
          kind: 'node',
          category: cat.label,
          color: '#' + nodeColor.getHexString(),
          label: node.label,
          body: node.body
        }
        root.add(m)
        clickable.push(m)
        addGlow(p, nodeColor, 5.5)

        edgePts.push(hub.x, hub.y, hub.z, p.x, p.y, p.z)
        edgeCols.push(color.r, color.g, color.b, nodeColor.r, nodeColor.g, nodeColor.b)
      })
    })

    // edges
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3))
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeCols, 3))
    const edges = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    root.add(edges)

    // ---- interaction ----
    const raycaster = new THREE.Raycaster()
    raycaster.params.Line = { threshold: 0 } as THREE.Raycaster['params']['Line']
    const pointer = new THREE.Vector2()
    let hovered: THREE.Mesh | null = null
    const dom = renderer.domElement

    function setPointer(e: PointerEvent): void {
      const rect = dom.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    function pick(): THREE.Mesh | null {
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(clickable, false)
      return hits.length ? (hits[0].object as THREE.Mesh) : null
    }

    function onMove(e: PointerEvent): void {
      setPointer(e)
      const hit = pick()
      if (hit !== hovered) {
        if (hovered) hovered.scale.multiplyScalar(1 / 1.6)
        hovered = hit
        if (hovered) hovered.scale.multiplyScalar(1.6)
        dom.style.cursor = hovered ? 'pointer' : 'grab'
      }
    }

    function onClick(e: PointerEvent): void {
      setPointer(e)
      const hit = pick()
      if (hit) {
        const u = hit.userData as Selected
        setSelected({ ...u })
      }
    }

    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerdown', onClick)
    dom.style.cursor = 'grab'

    // ---- resize ----
    function resize(): void {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // ---- loop ----
    let raf = 0
    function animate(): void {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerdown', onClick)
      controls.dispose()
      renderer.dispose()
      sphereGeo.dispose()
      edgeGeo.dispose()
      glowTex.dispose()
      if (dom.parentNode) dom.parentNode.removeChild(dom)
    }
  }, [])

  const nodeCount = brain.categories.reduce((n, c) => n + c.nodes.length, 0)

  return (
    <div className="brain-wrap" ref={mountRef}>
      <div className="brain-head">
        <div className="brain-title">THEO · brain</div>
        <div className="brain-stat">
          {nodeCount} axioms · {brain.categories.length} clusters · identity v
          {brain.identity_version}
        </div>
      </div>
      <div className="brain-hint">drag to rotate · scroll to zoom · click a node</div>

      {selected && (
        <div className="brain-panel">
          <button className="brain-close" onClick={() => setSelected(null)} aria-label="Close">
            ×
          </button>
          <div className="brain-panel-cat">
            <span className="brain-dot" style={{ background: selected.color }} />
            {selected.category}
            {selected.kind === 'hub' && selected.count != null && (
              <span className="brain-panel-count"> · {selected.count} axioms</span>
            )}
          </div>
          <div className="brain-panel-title">{selected.label}</div>
          {selected.body ? (
            <div className="brain-panel-body">{selected.body}</div>
          ) : (
            <div className="brain-panel-body dim">
              Cluster hub — click an individual node to read its axiom.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BrainSection
