import { useEffect, useRef, useState } from 'react'
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

// Clean label for the section list ("Tools — memory" -> group + name handled in UI).
function cleanLabel(label: string): string {
  return label.replace(/^Tools — /, '')
}
function isTool(id: string): boolean {
  return id.startsWith('toolgroup:')
}

const VERT = `
  attribute float size;
  attribute vec3 acolor;
  varying vec3 vColor;
  void main() {
    vColor = acolor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (270.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const FRAG = `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a);
  }
`

function BrainSection(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const applyRef = useRef<(s: number | null) => void>(() => {})
  const [sel, setSel] = useState<number | null>(null)

  const cats = brain.categories
  const N = cats.length

  // Drive the 3D highlight whenever the selection changes (from list or canvas).
  useEffect(() => {
    applyRef.current(sel)
  }, [sel])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    // Brain-shaped volume (ellipsoid: width, depth, height).
    const A = 50
    const B = 64
    const C = 44

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000)
    camera.position.set(0, 10, 190)

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

    // ---- build point cloud: one light per node, clustered by section ----
    const centroids: THREE.Vector3[] = []
    const positions: number[] = []
    const colors: number[] = []
    const sizes: number[] = []
    const pointCat: number[] = []
    const cat01 = cats.map((_, i) => catRGB(i, N).map((v) => v / 255) as number[])

    cats.forEach((cat, i) => {
      // Section centroid distributed through the brain volume (two lobes).
      const dir = fibDir(i, N)
      const rng = mulberry32(i * 2654435761 + 11)
      const rf = 0.32 + rng() * 0.55
      const cen = new THREE.Vector3(dir.x * A, dir.y * B, dir.z * C).multiplyScalar(rf)
      // hemisphere push (longitudinal fissure)
      cen.x += Math.sign(cen.x || 1) * 6
      centroids.push(cen)

      const spread = 7 + Math.min(cat.nodes.length, 16) * 0.7
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
    const posAttr = new THREE.Float32BufferAttribute(positions, 3)
    const colAttr = new THREE.Float32BufferAttribute(colors, 3)
    const sizeAttr = new THREE.Float32BufferAttribute(sizes, 1)
    geo.setAttribute('position', posAttr)
    geo.setAttribute('acolor', colAttr)
    geo.setAttribute('size', sizeAttr)

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const points = new THREE.Points(geo, mat)
    root.add(points)

    // subtle containment frame (scales with zoom)
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
    function applyHighlight(s: number | null): void {
      const col = colAttr.array as Float32Array
      const sz = sizeAttr.array as Float32Array
      for (let p = 0; p < count; p++) {
        const ci = pointCat[p]
        const base = cat01[ci]
        let f: number
        let size: number
        if (s === null) {
          f = 0.72
          size = 7
        } else if (ci === s) {
          f = 1.6
          size = 13
        } else {
          f = 0.08
          size = 4
        }
        col[p * 3] = base[0] * f
        col[p * 3 + 1] = base[1] * f
        col[p * 3 + 2] = base[2] * f
        sz[p] = size
      }
      colAttr.needsUpdate = true
      sizeAttr.needsUpdate = true
      desiredTarget.copy(s === null ? new THREE.Vector3(0, 0, 0) : centroids[s])
    }
    applyRef.current = applyHighlight
    applyHighlight(null)

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
        setSel((prev) => (prev === ci ? null : ci))
      }
    }
    dom.addEventListener('pointerdown', onClick)

    // ---- resize ----
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

  return (
    <div className="brain-wrap">
      <aside className="brain-sections">
        <div className="brain-sections-head">
          <div className="brain-title">THEO · brain</div>
          <div className="brain-stat">
            {nodeCount} nodes · {N} sections · v{brain.identity_version}
          </div>
          <button
            className={`brain-all${sel === null ? ' active' : ''}`}
            onClick={() => setSel(null)}
          >
            ◯ Show whole brain
          </button>
        </div>
        <div className="brain-sec-list">
          {cats.map((cat, i) => (
            <div key={cat.id}>
              <button
                className={`brain-sec-row${sel === i ? ' active' : ''}`}
                onClick={() => setSel(sel === i ? null : i)}
              >
                <span className="brain-dot" style={{ background: catCss(i, N) }} />
                <span className="brain-sec-label">
                  {isTool(cat.id) && <span className="brain-sec-pre">tool · </span>}
                  {cleanLabel(cat.label)}
                </span>
                <span className="brain-sec-count">{cat.nodes.length}</span>
              </button>
              {sel === i && (
                <ul className="brain-items">
                  {cat.nodes.map((node) => (
                    <li key={node.id} className="brain-item">
                      {node.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="brain-stage" ref={stageRef}>
        <div className="brain-hint">drag to rotate · scroll to zoom · click a region or a section</div>
      </div>
    </div>
  )
}

export default BrainSection
