import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Theo's memory, live.
//
// The vault is a weighted association graph (python/agent/vault_graph.py). When
// a message names something he knows, `recall_block` fires those notes and lets
// the charge spread through the links — that's spreading activation, and it's
// what actually decides which memories reach him on a given turn.
//
// This renders that. Every cascade you see below is a real event the bridge
// emitted (/brain/activity), replayed edge by edge: the seeds he recognized,
// the charge that reached each note, the hop it arrived on. Between real
// thoughts he idles — a salient memory fires on its own every few seconds, so
// the graph breathes instead of sitting dead.
//
// Canvas 2D, not three.js: this is a 2D force graph with additive light, and
// WebGL would buy nothing but a bigger bundle.
// ---------------------------------------------------------------------------

type GNode = {
  id: string
  t: string
  y: string
  s: number
  d: number
  x: number
  y2: number // screen-space y lives in y2; `y` is taken by the note's type
  vx: number
  vy: number
  rad: number
}

// Maps of content are indexes, not memories — "Vocabulary" alone links to 98
// notes and turns the whole graph into a hairball. Drop them.
const DROPPED_TYPES = new Set(['moc'])

// Travel time per hop. Deliberately slow: the whole point is that you can watch
// a thought cross the gap and follow it.
const HOP_MS = 820
const HOP_JITTER = 520
const FLARE_MS = 620
const MAX_FANOUT = 5

const C_FLOW = ['#79bdff', '#b9e0ff', '#eaf6ff']

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function BrainSection(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const [graph, setGraph] = useState<BrainGraph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [thought, setThought] = useState<string | null>(null)
  // The canvas engine installs its event-firing entry point here so the polling
  // effect can drive it without tearing down the render loop.
  const fireEventRef = useRef<(ev: BrainEvent) => void>(() => {})

  // ---- load the graph ----
  useEffect(() => {
    let alive = true
    window.theo
      .getBrainGraph()
      .then((g) => {
        if (!alive) return
        if (!g?.nodes?.length) {
          setError('His vault came back empty.')
          return
        }
        setGraph(g)
      })
      .catch(() =>
        alive &&
        setError("Can't reach Theo's backend — his memory server isn't answering.")
      )
    return () => {
      alive = false
    }
  }, [])

  // ---- poll for real thoughts ----
  useEffect(() => {
    if (!graph) return
    let alive = true
    // -1 until we've primed. The first poll only reads the high-water mark: we
    // don't want to open the tab and get 40 backlogged cascades at once.
    let since = -1
    const tick = async (): Promise<void> => {
      try {
        const res = await window.theo.getBrainActivity(Math.max(0, since))
        if (!alive) return
        if (since < 0) {
          since = res.latest
          return
        }
        for (const ev of res.events) {
          fireEventRef.current(ev)
          const named = ev.seeds
            .map((s) => graph.nodes.find((n) => n.id === s)?.t ?? s)
            .join(' · ')
          setThought(named || null)
        }
        since = Math.max(since, res.latest)
      } catch {
        /* bridge blipped — the next tick will catch up */
      }
    }
    void tick()
    const iv = setInterval(() => void tick(), 2000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [graph])

  // ---- the engine ----
  useEffect(() => {
    const stage = stageRef.current
    if (!graph || !stage) return

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    // --- model ---
    const nodes: GNode[] = graph.nodes
      .filter((n) => !DROPPED_TYPES.has(n.y))
      .map((n) => {
        const a = Math.random() * Math.PI * 2
        const r = 460 * (1 - n.s * 0.5) * Math.sqrt(Math.random())
        return {
          id: n.id,
          t: n.t,
          y: n.y,
          s: n.s,
          d: n.d,
          x: Math.cos(a) * r,
          y2: Math.sin(a) * r,
          vx: 0,
          vy: 0,
          rad: 2.1 + n.s * 7.0 // size carries salience — what matters looks like it
        }
      })
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const edges = graph.edges.filter((e) => byId.has(e.a) && byId.has(e.b))
    const adj = new Map<string, { id: string; w: number }[]>(nodes.map((n) => [n.id, []]))
    for (const e of edges) {
      adj.get(e.a)!.push({ id: e.b, w: e.w })
      adj.get(e.b)!.push({ id: e.a, w: e.w })
    }

    // --- canvas / camera ---
    const cv = document.createElement('canvas')
    cv.className = 'brain-canvas'
    stage.appendChild(cv)
    const ctx = cv.getContext('2d')!
    let W = 0
    let H = 0
    const cam = { x: 0, y: 0, s: 1, ts: 1 } // ts = target scale, for smooth zoom

    function resize(): void {
      const dpr = Math.min(2, devicePixelRatio || 1)
      W = stage!.clientWidth
      H = stage!.clientHeight
      if (!W || !H) return
      cv.width = W * dpr
      cv.height = H * dpr
      cv.style.width = W + 'px'
      cv.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(stage)

    const toScreen = (x: number, y: number): [number, number] => [
      W / 2 + (x + cam.x) * cam.s,
      H / 2 + (y + cam.y) * cam.s
    ]
    const toWorld = (sx: number, sy: number): [number, number] => [
      (sx - W / 2) / cam.s - cam.x,
      (sy - H / 2) / cam.s - cam.y
    ]

    let fitted = false
    function fit(): void {
      let minX = 1e9
      let minY = 1e9
      let maxX = -1e9
      let maxY = -1e9
      for (const n of nodes) {
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
        minY = Math.min(minY, n.y2)
        maxY = Math.max(maxY, n.y2)
      }
      cam.x = -(minX + maxX) / 2
      cam.y = -(minY + maxY) / 2
      // Deliberately NOT fitting the whole graph: that cancels out the wide
      // spacing the layout works for. Start zoomed in, edges long on screen,
      // inside his memory — scroll out to see the whole shape.
      const fitScale = Math.min(W / (maxX - minX + 220), H / (maxY - minY + 220), 1.3)
      cam.ts = cam.s = Math.max(fitScale, 0.82)
    }

    // --- force layout ---
    // Strong repulsion + a long rest length: connected memories settle far
    // apart, which is what buys you the travel time to actually follow a thought.
    let frame = 0
    function layoutStep(): void {
      const cooling = Math.max(0.05, 1 - frame / 520)
      const REP = 4200
      const SPRING = 0.0062
      const REST = 165
      const GRAV = 0.00085
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          let dx = a.x - b.x
          let dy = a.y2 - b.y2
          let d2 = dx * dx + dy * dy
          if (d2 < 1) {
            d2 = 1
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
          }
          const d = Math.sqrt(d2)
          const f = REP / d2
          const fx = (dx / d) * f
          const fy = (dy / d) * f
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
        a.vx -= a.x * GRAV
        a.vy -= a.y2 * GRAV
      }
      for (const e of edges) {
        const a = byId.get(e.a)!
        const b = byId.get(e.b)!
        const dx = b.x - a.x
        const dy = b.y2 - a.y2
        const d = Math.hypot(dx, dy) || 1
        const f = (d - REST) * SPRING * (0.6 + e.w * 0.3)
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
      for (const n of nodes) {
        n.vx *= 0.82
        n.vy *= 0.82
        const sp = Math.hypot(n.vx, n.vy)
        if (sp > 6) {
          n.vx = (n.vx / sp) * 6
          n.vy = (n.vy / sp) * 6
        }
        n.x += n.vx * cooling
        n.y2 += n.vy * cooling
      }
      frame++
      if (frame === 90 && !fitted) {
        fit()
        fitted = true
      }
    }

    // --- activation ---
    type Flow = { a: string; b: string; t0: number; dur: number; str: number }
    type Flare = { id: string; t0: number; str: number }
    // Each queued hop carries its OWN continuation. Two recalls can overlap in
    // flight (he thinks faster than the animation runs), and they must not share
    // a walker — each cascade owns its visited set and its activation map.
    type Pending = {
      id: string
      at: number
      str: number
      hop: number
      cb: (id: string, str: number, hop: number) => void
    }
    const flows: Flow[] = []
    const flares: Flare[] = []
    const pending: Pending[] = []

    // Replay a REAL recall. We only travel edges into notes that genuinely
    // activated, and the brightness at each stop is the charge that actually
    // reached it — so what you watch is his spread, not a pretty approximation.
    function fireEvent(ev: BrainEvent): void {
      const act = ev.act || {}
      const seeds = ev.seeds.filter((s) => byId.has(s))
      if (!seeds.length) return
      // Charge accumulates across contributors, so it isn't bounded at 1 —
      // normalize against this event's own peak to get a sane brightness.
      const peak = Math.max(1e-6, ...Object.values(act))
      const seen = new Set<string>(seeds)
      const now = performance.now()

      const walk = (id: string, _str: number, hop: number): void => {
        const nbrs = (adj.get(id) || [])
          .filter((nb) => !seen.has(nb.id) && act[nb.id] !== undefined)
          // Follow the strongest charge first, and cap fan-out so a hub doesn't
          // white out the screen.
          .sort((p, q) => (act[q.id] ?? 0) - (act[p.id] ?? 0))
          .slice(0, MAX_FANOUT)
        for (const nb of nbrs) {
          seen.add(nb.id)
          const dur = HOP_MS + Math.random() * HOP_JITTER
          const str = Math.min(1, (act[nb.id] ?? 0) / peak)
          flows.push({ a: id, b: nb.id, t0: performance.now(), dur, str })
          pending.push({ id: nb.id, at: performance.now() + dur * 0.82, str, hop: hop + 1, cb: walk })
        }
      }
      // Seeds enter the same queue as every other hop — the scheduler blooms
      // each note as it arrives, so seeds and downstream notes light the same way.
      for (const s of seeds) pending.push({ id: s, at: now, str: 1, hop: 0, cb: walk })
    }

    // Idle thinking: between real recalls, let a salient memory fire on its own
    // so the graph is alive rather than a still image. Weighted by salience —
    // what matters to him surfaces more often.
    const pool: string[] = []
    for (const n of nodes) {
      const k = Math.max(1, Math.round(n.s * 6))
      for (let i = 0; i < k; i++) pool.push(n.id)
    }
    // A speculative spread: no real recall to replay, so it walks the graph the
    // way the backend would (salience-first, decaying each hop). Used for idle
    // thinking and when you click a memory yourself.
    function fireAmbient(seedId: string, strength = 0.9): void {
      if (!byId.has(seedId)) return
      const seen = new Set([seedId])
      const step = (id: string, str: number, hop: number): void => {
        if (hop >= 5 || str < 0.11) return
        const nbrs = (adj.get(id) || [])
          .filter((nb) => !seen.has(nb.id))
          .sort((p, q) => (byId.get(q.id)?.s ?? 0) - (byId.get(p.id)?.s ?? 0))
          .slice(0, MAX_FANOUT)
        for (const nb of nbrs) {
          seen.add(nb.id)
          const dur = HOP_MS + Math.random() * HOP_JITTER
          flows.push({ a: id, b: nb.id, t0: performance.now(), dur, str })
          pending.push({
            id: nb.id,
            at: performance.now() + dur * 0.82,
            str: str * 0.62, // same decay the real spread uses
            hop: hop + 1,
            cb: step
          })
        }
      }
      pending.push({ id: seedId, at: performance.now(), str: strength, hop: 0, cb: step })
    }
    let nextAmbient = 2600

    fireEventRef.current = fireEvent

    // --- starfield: depth in the void ---
    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.5 + 0.1,
      tw: Math.random() * Math.PI * 2
    }))

    // --- interaction ---
    let hover: GNode | null = null
    const mouse = { x: -9, y: -9 }
    let drag: { px: number; py: number } | null = null
    let moved = 0

    // Takes canvas-local coords (not client) — the caller converts once.
    function nearest(lx: number, ly: number): GNode | null {
      let best: GNode | null = null
      let bd = 26 * 26
      for (const n of nodes) {
        const [x, y] = toScreen(n.x, n.y2)
        const d = (x - lx) ** 2 + (y - ly) ** 2
        if (d < bd) {
          bd = d
          best = n
        }
      }
      return best
    }
    function onMove(ev: MouseEvent): void {
      const rect = cv.getBoundingClientRect()
      mouse.x = ev.clientX - rect.left
      mouse.y = ev.clientY - rect.top
      if (drag) {
        const dx = ev.clientX - drag.px
        const dy = ev.clientY - drag.py
        cam.x += dx / cam.s
        cam.y += dy / cam.s
        drag.px = ev.clientX
        drag.py = ev.clientY
        moved += Math.abs(dx) + Math.abs(dy)
      }
    }
    function onDown(ev: MouseEvent): void {
      drag = { px: ev.clientX, py: ev.clientY }
      moved = 0
    }
    function onUp(ev: MouseEvent): void {
      // A click, not a pan → send a thought through that memory.
      if (drag && moved < 5) {
        const rect = cv.getBoundingClientRect()
        const n = nearest(ev.clientX - rect.left, ev.clientY - rect.top)
        if (n) {
          fireAmbient(n.id, 1)
          setThought(n.t)
        }
      }
      drag = null
    }
    function onWheel(ev: WheelEvent): void {
      ev.preventDefault()
      const rect = cv.getBoundingClientRect()
      const [wx, wy] = toWorld(ev.clientX - rect.left, ev.clientY - rect.top)
      cam.ts = Math.max(0.35, Math.min(4.5, cam.ts * (ev.deltaY < 0 ? 1.12 : 0.89)))
      requestAnimationFrame(() => {
        const [nx, ny] = toWorld(ev.clientX - rect.left, ev.clientY - rect.top)
        cam.x += nx - wx
        cam.y += ny - wy
      })
    }
    cv.addEventListener('mousemove', onMove)
    cv.addEventListener('mousedown', onDown)
    cv.addEventListener('wheel', onWheel, { passive: false })
    addEventListener('mouseup', onUp)

    // --- render ---
    function draw(now: number): void {
      const g = ctx.createRadialGradient(
        W / 2,
        H * 0.42,
        0,
        W / 2,
        H * 0.5,
        Math.hypot(W, H) * 0.62
      )
      g.addColorStop(0, '#0c1630')
      g.addColorStop(0.55, '#080e1e')
      g.addColorStop(1, '#04060d')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)

      for (const s of stars) {
        const a = s.a * (0.6 + 0.4 * Math.sin(now * 0.0012 + s.tw))
        ctx.fillStyle = `rgba(150,180,235,${a.toFixed(3)})`
        ctx.fillRect(s.x * W, s.y * H, s.r, s.r)
      }

      cam.s += (cam.ts - cam.s) * 0.12

      // How recently each note lit — drives both edge heat and node core.
      const heat = new Map<string, number>()
      for (const f of flares) {
        const k = (now - f.t0) / FLARE_MS
        if (k < 1) heat.set(f.id, Math.max(heat.get(f.id) ?? 0, (1 - k) * f.str))
      }

      // dormant links
      ctx.lineWidth = 1
      for (const e of edges) {
        const a = byId.get(e.a)!
        const b = byId.get(e.b)!
        const [ax, ay] = toScreen(a.x, a.y2)
        const [bx, by] = toScreen(b.x, b.y2)
        const h = Math.max(heat.get(e.a) ?? 0, heat.get(e.b) ?? 0)
        ctx.strokeStyle = `rgba(92,132,205,${(0.045 + h * 0.14).toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      // the charge itself — additive, so crossing streams bloom
      ctx.globalCompositeOperation = 'lighter'
      for (let i = flows.length - 1; i >= 0; i--) {
        const fl = flows[i]
        const p = (now - fl.t0) / fl.dur
        if (p >= 1) {
          flows.splice(i, 1)
          continue
        }
        const a = byId.get(fl.a)!
        const b = byId.get(fl.b)!
        const [ax, ay] = toScreen(a.x, a.y2)
        const [bx, by] = toScreen(b.x, b.y2)
        const streamN = 10
        for (let k = 0; k < streamN; k++) {
          const t = p - k * 0.055
          if (t < 0 || t > 1) continue
          const x = lerp(ax, bx, t)
          const y = lerp(ay, by, t)
          const head = k === 0
          const size = (head ? 3.2 : 2.1) * (0.7 + fl.str * 0.7) * (1 - k / streamN)
          const col = C_FLOW[k === 0 ? 2 : k === 1 ? 1 : 0]
          const rg = ctx.createRadialGradient(x, y, 0, x, y, size * 3.4)
          rg.addColorStop(0, col)
          rg.addColorStop(0.5, 'rgba(110,180,255,0.5)')
          rg.addColorStop(1, 'rgba(60,120,220,0)')
          ctx.fillStyle = rg
          ctx.globalAlpha = (head ? 0.95 : 0.6) * (1 - p * 0.15)
          ctx.beginPath()
          ctx.arc(x, y, size * 3.4, 0, 7)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // arrival blooms
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i]
        const k = (now - f.t0) / FLARE_MS
        if (k >= 1) {
          flares.splice(i, 1)
          continue
        }
        const n = byId.get(f.id)
        if (!n) continue
        const [x, y] = toScreen(n.x, n.y2)
        const rad = (n.rad + 6) * cam.s * (0.6 + k * 2.4)
        const rg = ctx.createRadialGradient(x, y, 0, x, y, rad)
        rg.addColorStop(0, `rgba(220,240,255,${((1 - k) * f.str * 0.5).toFixed(3)})`)
        rg.addColorStop(1, 'rgba(120,180,255,0)')
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, 7)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // the memories themselves
      hover = nearest(mouse.x, mouse.y) // mouse is already canvas-local
      for (const n of nodes) {
        const [x, y] = toScreen(n.x, n.y2)
        const h = heat.get(n.id) ?? 0
        const r = n.rad * cam.s
        const core = h > 0.02 ? '#f2f8ff' : '#cfe2fb'
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4)
        rg.addColorStop(0, core)
        rg.addColorStop(0.42, `rgba(150,195,255,${(0.85 + h * 0.15).toFixed(2)})`)
        rg.addColorStop(1, 'rgba(90,140,225,0)')
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(x, y, r * 2.4, 0, 7)
        ctx.fill()
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(x, y, Math.max(0.8, r * 0.55), 0, 7)
        ctx.fill()
      }

      // Names: the salient ones stay legible, everything else on hover — else
      // 114 labels stacked on top of each other and you can read none of them.
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      for (const n of nodes) {
        const isHover = hover === n
        if (n.s < 0.62 && !isHover) continue
        const [x, y] = toScreen(n.x, n.y2)
        ctx.font = (isHover ? '600 13px ' : '500 11.5px ') + '"Segoe UI", system-ui, sans-serif'
        const a = isHover ? 0.98 : Math.min(0.62, (n.s - 0.5) * 1.5)
        ctx.fillStyle = `rgba(216,232,255,${a.toFixed(2)})`
        ctx.shadowColor = 'rgba(6,12,26,0.9)'
        ctx.shadowBlur = 6
        ctx.fillText(n.t, x, y - n.rad * cam.s - 3)
        ctx.shadowBlur = 0
      }
      cv.style.cursor = hover ? 'pointer' : drag ? 'grabbing' : 'crosshair'
    }

    // --- loop ---
    let raf = 0
    let last = performance.now()
    function tick(now: number): void {
      raf = requestAnimationFrame(tick)
      const dt = now - last
      last = now
      layoutStep()

      // Every hop, real or idle: it lands, it blooms, it walks onward.
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].at > now) continue
        const p = pending[i]
        pending.splice(i, 1)
        flares.push({ id: p.id, t0: now, str: p.str })
        p.cb(p.id, p.str, p.hop)
      }
      if (!reduce) {
        nextAmbient -= dt
        if (nextAmbient <= 0) {
          fireAmbient(pool[Math.floor(Math.random() * pool.length)])
          nextAmbient = 4200 + Math.random() * 3200
        }
      }
      draw(now)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.removeEventListener('mousemove', onMove)
      cv.removeEventListener('mousedown', onDown)
      cv.removeEventListener('wheel', onWheel)
      removeEventListener('mouseup', onUp)
      fireEventRef.current = () => {}
      cv.remove()
    }
  }, [graph])

  const memoryCount = graph
    ? graph.nodes.filter((n) => !DROPPED_TYPES.has(n.y)).length
    : 0

  return (
    <div className="brain-void" ref={stageRef}>
      <div className="brain-hud brain-hud-tl">
        <div className="brain-eyebrow">Theo · Memory</div>
        <div className="brain-sub">
          {error
            ? 'offline'
            : graph
              ? `spreading activation — live · ${memoryCount} memories`
              : 'reaching his vault…'}
        </div>
      </div>

      {thought && !error && (
        <div className="brain-hud brain-hud-tr">
          <div className="brain-thought-label">thinking about</div>
          <div className="brain-thought">{thought}</div>
        </div>
      )}

      <div className="brain-hud brain-hud-bl">
        {error ? (
          <div className="brain-hint brain-err">{error}</div>
        ) : (
          <div className="brain-hint">
            A thought moves through him as light. <b>Click any memory</b> to send one — or
            just watch him think.
          </div>
        )}
      </div>

      {!error && (
        <div className="brain-hud brain-hud-br">real vault · drag to pan · scroll to zoom</div>
      )}
    </div>
  )
}

export default BrainSection
