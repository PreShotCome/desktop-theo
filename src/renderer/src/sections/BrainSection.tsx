import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { brain } from '../data/brain'

// teal -> violet, in 0..255
const TEAL = [0x36, 0xe0, 0xc8]
const VIOLET = [0x8b, 0x5c, 0xf6]
function catRGB(i: number, n: number): [number, number, number] {
  const t = n > 1 ? i / (n - 1) : 0
  return [
    TEAL[0] + (VIOLET[0] - TEAL[0]) * t,
    TEAL[1] + (VIOLET[1] - TEAL[1]) * t,
    TEAL[2] + (VIOLET[2] - TEAL[2]) * t
  ]
}
function catCss(i: number, n: number): string {
  const c = catRGB(i, n)
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fibDir(i: number, n: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(phi)
  )
}

function cleanLabel(label: string): string {
  return label.replace(/^Tools — /, '')
}

// Meaningful super-groups, each mapped to a region of the brain.
type GroupKey = 'core' | 'principles' | 'voice' | 'skills' | 'research' | 'memory' | 'tools'
function groupOf(id: string): GroupKey {
  if (id === 'core') return 'core'
  if (id === 'principles') return 'principles'
  if (id === 'voice') return 'voice'
  if (id === 'skills') return 'skills'
  if (id === 'research') return 'research'
  if (id === 'memory') return 'memory'
  return 'tools'
}
// Anchor direction in normalized ellipsoid space (x=L/R, y=front/back, z=up/down).
const ANCHOR: Record<GroupKey, THREE.Vector3> = {
  core: new THREE.Vector3(0.0, 0.0, 0.0),
  principles: new THREE.Vector3(-0.12, 0.28, 0.62),
  voice: new THREE.Vector3(-0.62, 0.32, 0.08),
  skills: new THREE.Vector3(0.2, 0.66, 0.18),
  memory: new THREE.Vector3(0.0, -0.32, -0.56),
  research: new THREE.Vector3(-0.18, -0.66, 0.12),
  tools: new THREE.Vector3(0.58, -0.04, 0.0)
}
const GSPREAD: Record<GroupKey, number> = {
  core: 0.1,
  principles: 0.16,
  voice: 0.22,
  skills: 0.2,
  memory: 0.18,
  research: 0.24,
  tools: 0.5
}

type Sel = { type: 'none' } | { type: 'section'; i: number } | { type: 'tools' }

function BrainSection(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const applyRef = useRef<(s: Sel) => void>(() => {})
  const [sel, setSel] = useState<Sel>({ type: 'none' })
  const [toolsOpen, setToolsOpen] = useState(false)

  const cats = brain.categories
  const N = cats.length

  // List structure: non-tool sections inline, all tool sections under one group.
  const { items, toolMembers, toolNodeCount } = useMemo(() => {
    const toolMembers = cats
      .map((c, i) => ({ c, i }))
      .filter((x) => groupOf(x.c.id) === 'tools')
      .map((x) => ({ index: x.i, label: cleanLabel(x.c.label), count: x.c.nodes.length }))
    const toolNodeCount = toolMembers.reduce((n, m) => n + m.count, 0)
    const items: ({ kind: 'section'; index: number } | { kind: 'tools' })[] = []
    let inserted = false
    cats.forEach((c, i) => {
      if (groupOf(c.id) === 'tools') {
        if (!inserted) {
          items.push({ kind: 'tools' })
          inserted = true
        }
      } else {
        items.push({ kind: 'section', index: i })
      }
    })
    return { items, toolMembers, toolNodeCount }
  }, [])

  useEffect(() => {
    applyRef.current(sel)
  }, [sel])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const A = 50
    const B = 64
    const C = 44

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000)
    camera.position.set(0, 10, 195)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    stage.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 12
    controls.maxDistance = 700
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4

    const root = new THREE.Group()
    scene.add(root)

    // group members (stable order) for region layout
    const groupMembers: Record<string, number[]> = {}
    cats.forEach((c, i) => {
      const g = groupOf(c.id)
      ;(groupMembers[g] ||= []).push(i)
    })
    const toolIdx = new Set(groupMembers['tools'] || [])

    const centroids: THREE.Vector3[] = []
    const positions: number[] = []
    const colors: number[] = []
    const sizes: number[] = []
    const pointCat: number[] = []
    const cat01 = cats.map((_, i) => catRGB(i, N).map((v) => v / 255) as number[])

    cats.forEach((cat, i) => {
      const g = groupOf(cat.id)
      const members = groupMembers[g]
      const li = members.indexOf(i)
      const dir = fibDir(li, members.length)
      const cn = ANCHOR[g].clone().add(dir.multiplyScalar(GSPREAD[g]))
      const cen = new THREE.Vector3(cn.x * A, cn.y * B, cn.z * C).multiplyScalar(0.9)
      cen.x += Math.sign(cen.x || 1) * 5 // longitudinal fissure
      centroids.push(cen)

      const rng = mulberry32(i * 2654435761 + 11)
      const spread = 6 + Math.min(cat.nodes.length, 16) * 0.6
      cat.nodes.forEach(() => {
        const off = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5)
          .normalize()
          .multiplyScalar(spread * (0.4 + rng() * 0.8))
        const p = cen.clone().add(off)
        positions.push(p.x, p.y, p.z)
        colors.push(cat01[i][0], cat01[i][1], cat01[i][2])
        sizes.push(7)
        pointCat.push(i)
      })
    })

    const count = pointCat.length
    const geo = new THREE.BufferGeometry()
    const colAttr = new THREE.Float32BufferAttribute(colors, 3)
    const sizeAttr = new THREE.Float32BufferAttribute(sizes, 1)
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('acolor', colAttr)
    geo.setAttribute('size', sizeAttr)

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute vec3 acolor;
        varying vec3 vColor;
        void main() {
          vColor = acolor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (270.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const points = new THREE.Points(geo, mat)
    root.add(points)

    const frame = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 3)),
      new THREE.LineBasicMaterial({
        color: new THREE.Color('#36e0c8'),
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    frame.scale.set(A * 1.18, B * 1.18, C * 1.18)
    root.add(frame)

    // ---- highlight ----
    const desiredTarget = new THREE.Vector3(0, 0, 0)
    const toolsCenter = new THREE.Vector3(
      ANCHOR.tools.x * A,
      ANCHOR.tools.y * B,
      ANCHOR.tools.z * C
    ).multiplyScalar(0.9)

    function applyHighlight(s: Sel): void {
      let set: Set<number> | null = null
      const target = new THREE.Vector3(0, 0, 0)
      if (s.type === 'section') {
        set = new Set([s.i])
        target.copy(centroids[s.i])
      } else if (s.type === 'tools') {
        set = toolIdx
        target.copy(toolsCenter)
      }
      const col = colAttr.array as Float32Array
      const sz = sizeAttr.array as Float32Array
      for (let p = 0; p < count; p++) {
        const ci = pointCat[p]
        const base = cat01[ci]
        let f: number
        let size: number
        if (set === null) {
          f = 0.72
          size = 7
        } else if (set.has(ci)) {
          f = 1.6
          size = 13
        } else {
          f = 0.07
          size = 4
        }
        col[p * 3] = base[0] * f
        col[p * 3 + 1] = base[1] * f
        col[p * 3 + 2] = base[2] * f
        sz[p] = size
      }
      colAttr.needsUpdate = true
      sizeAttr.needsUpdate = true
      desiredTarget.copy(target)
    }
    applyRef.current = applyHighlight
    applyHighlight({ type: 'none' })

    // ---- click a region -> select its section ----
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 3.2 }
    const ptr = new THREE.Vector2()
    const dom = renderer.domElement
    dom.style.cursor = 'grab'
    function onClick(e: PointerEvent): void {
      const rect = dom.getBoundingClientRect()
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ptr, camera)
      const hits = raycaster.intersectObject(points, false)
      if (hits.length && hits[0].index != null) {
        const ci = pointCat[hits[0].index]
        if (toolIdx.has(ci)) setToolsOpen(true)
        setSel((prev) => (prev.type === 'section' && prev.i === ci ? { type: 'none' } : { type: 'section', i: ci }))
      }
    }
    dom.addEventListener('pointerdown', onClick)

    function resize(): void {
      const w = stage!.clientWidth
      const h = stage!.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(stage)

    let raf = 0
    function animate(): void {
      raf = requestAnimationFrame(animate)
      controls.target.lerp(desiredTarget, 0.06)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dom.removeEventListener('pointerdown', onClick)
      controls.dispose()
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      frame.geometry.dispose()
      ;(frame.material as THREE.Material).dispose()
      if (dom.parentNode) dom.parentNode.removeChild(dom)
    }
  }, [])

  const nodeCount = cats.reduce((n, c) => n + c.nodes.length, 0)
  const isSecActive = (i: number): boolean => sel.type === 'section' && sel.i === i

  function ItemList({ idx }: { idx: number }): JSX.Element {
    return (
      <ul className="brain-items">
        {cats[idx].nodes.map((node) => (
          <li key={node.id} className="brain-item">
            {node.label}
          </li>
        ))}
      </ul>
    )
  }

  function selSection(i: number): void {
    setSel(isSecActive(i) ? { type: 'none' } : { type: 'section', i })
  }

  return (
    <div className="brain-wrap">
      <aside className="brain-sections">
        <div className="brain-sections-head">
          <div className="brain-title">THEO · brain</div>
          <div className="brain-stat">
            {nodeCount} nodes · {N} sections · v{brain.identity_version}
          </div>
          <button
            className={`brain-all${sel.type === 'none' ? ' active' : ''}`}
            onClick={() => setSel({ type: 'none' })}
          >
            ◯ Show whole brain
          </button>
        </div>
        <div className="brain-sec-list">
          {items.map((it) =>
            it.kind === 'section' ? (
              <div key={cats[it.index].id}>
                <button
                  className={`brain-sec-row${isSecActive(it.index) ? ' active' : ''}`}
                  onClick={() => selSection(it.index)}
                >
                  <span className="brain-dot" style={{ background: catCss(it.index, N) }} />
                  <span className="brain-sec-label">{cats[it.index].label}</span>
                  <span className="brain-sec-count">{cats[it.index].nodes.length}</span>
                </button>
                {isSecActive(it.index) && <ItemList idx={it.index} />}
              </div>
            ) : (
              <div key="tools-group">
                <button
                  className={`brain-sec-row${sel.type === 'tools' ? ' active' : ''}`}
                  onClick={() => {
                    if (sel.type === 'tools') {
                      setSel({ type: 'none' })
                      setToolsOpen(false)
                    } else {
                      setSel({ type: 'tools' })
                      setToolsOpen(true)
                    }
                  }}
                >
                  <span className={`brain-chevron${toolsOpen ? ' open' : ''}`}>▶</span>
                  <span className="brain-sec-label">Tools</span>
                  <span className="brain-sec-count">{toolNodeCount}</span>
                </button>
                {toolsOpen &&
                  toolMembers.map((m) => (
                    <div key={cats[m.index].id}>
                      <button
                        className={`brain-sec-row sub${isSecActive(m.index) ? ' active' : ''}`}
                        onClick={() => selSection(m.index)}
                      >
                        <span className="brain-dot" style={{ background: catCss(m.index, N) }} />
                        <span className="brain-sec-label">{m.label}</span>
                        <span className="brain-sec-count">{m.count}</span>
                      </button>
                      {isSecActive(m.index) && <ItemList idx={m.index} />}
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
      </aside>

      <div className="brain-stage" ref={stageRef}>
        <div className="brain-hint">drag to rotate · scroll to zoom · click a region or a section</div>
      </div>
    </div>
  )
}

export default BrainSection
