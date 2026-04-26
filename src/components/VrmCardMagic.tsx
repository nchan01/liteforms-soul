import { useEffect, useRef, useState } from "react"

interface VrmCardProps {
  vrmUrl: string
  alt: string
}

/**
 * VrmCardMagic — holographic aquarium edition.
 * Features: aquarium background, holographic foil overlay,
 * mouse-tracked X+Y rotation, click-to-snap wobble, speech bubble.
 * Pages Router / SSR-safe: imported with dynamic({ssr:false}) by the page.
 */
export default function VrmCardMagic({ vrmUrl, alt }: VrmCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [hovered, setHovered] = useState(false)
  const [snapFlash, setSnapFlash] = useState(false)

  // Refs for rAF-safe mutation
  const mouseRef = useRef({ x: 0, y: 0 })
  const snapRef = useRef(0)

  // ── IntersectionObserver lazy init ──
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect()
          setState("loading")
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // ── Three.js init ──
  useEffect(() => {
    if (state !== "loading") return
    if (!canvasRef.current) return

    let cancelled = false
    let animId: number

    async function init() {
      const canvas = canvasRef.current!
      const THREE = await import("three")
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
      const { VRMLoaderPlugin } = await import("@pixiv/three-vrm")

      if (cancelled) return

      const w = canvas.clientWidth || 200
      const h = canvas.clientHeight || 150

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(w, h, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace

      const scene = new THREE.Scene()
      const fovDeg = 35
      const camera = new THREE.PerspectiveCamera(fovDeg, w / h, 0.1, 100)

      // Underwater lighting: blue-tinted ambient + white directional + rim light
      scene.add(new THREE.AmbientLight(0x88bbff, 0.7))
      const dir = new THREE.DirectionalLight(0xffffff, 1.0)
      dir.position.set(1, 2, 2)
      scene.add(dir)
      const rim = new THREE.DirectionalLight(0x2244ff, 0.4)
      rim.position.set(0, 0, -3)
      scene.add(rim)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let model: any = null
      let startTime = Date.now()

      const loader = new GLTFLoader()
      loader.register(p => new VRMLoaderPlugin(p))
      loader.load(
        vrmUrl,
        (gltf) => {
          if (cancelled) return
          const vrm = (gltf as any).userData.vrm
          const root = vrm ? vrm.scene : gltf.scene
          scene.add(root)

          // Center model at origin
          const box = new THREE.Box3().setFromObject(root)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          root.position.sub(center)

          // Fit camera: same formula as VrmCard
          const maxDim = Math.max(size.x, size.y, size.z)
          const fovRad = fovDeg * (Math.PI / 180)
          const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.2
          camera.position.set(0, size.y * 0.05, dist)
          camera.lookAt(0, 0, 0)

          // Face camera immediately — don't wait for lerp
          root.rotation.y = Math.PI
          startTime = Date.now()
          model = root
          setState("ready")
        },
        undefined,
        () => setState("error")
      )

      function animate() {
        if (cancelled) return
        animId = requestAnimationFrame(animate)

        if (model) {
          const t = (Date.now() - startTime) * 0.001
          // Gentle idle rock: ±15° around forward-facing (Math.PI)
          const idleRock = Math.PI + Math.sin(t * 0.6) * 0.26

          // Snap wobble decays over time
          let snapOffset = 0
          if (snapRef.current > 0.01) {
            snapOffset = Math.sin(snapRef.current * Math.PI * 5) * 0.5
            snapRef.current *= 0.82
          }

          // Mouse overrides idle: lerp toward cursor with gentle factor
          const targetX = -mouseRef.current.y * 0.2
          const targetY = idleRock + mouseRef.current.x * 0.35 + snapOffset
          model.rotation.x += (targetX - model.rotation.x) * 0.05
          model.rotation.y += (targetY - model.rotation.y) * 0.05
        }

        renderer.render(scene, camera)
      }
      animate()
    }

    init().catch(() => setState("error"))

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
    }
  }, [state, vrmUrl])

  // ── Mouse tracking for rotation + holographic angle ──
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const nx = (e.clientX - cx) / (rect.width / 2)
    const ny = (e.clientY - cy) / (rect.height / 2)
    mouseRef.current = { x: nx, y: ny }

    // Holo angle: atan2 from center, mapped to degrees
    const angleDeg = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
    if (foilRef.current) {
      foilRef.current.style.setProperty("--ha", `${angleDeg}deg`)
    }
  }

  function handleMouseLeave() {
    mouseRef.current = { x: 0, y: 0 }
    setHovered(false)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    snapRef.current = 1.0
    setSnapFlash(true)
    setTimeout(() => setSnapFlash(false), 600)
  }

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* ── Three.js canvas ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: state === "ready" || state === "loading" ? "block" : "none",
          cursor: "crosshair",
        }}
        aria-label={alt}
        title="Move mouse to look — click to snap"
      />

      {/* ── Holographic foil overlay ── */}
      <div
        ref={foilRef}
        className="vrm-holo-foil"
        style={{ opacity: hovered ? 0.3 : 0 } as React.CSSProperties}
        aria-hidden="true"
      />

      {/* ── Speech bubble (hover) ── */}
      <div
        className="vrm-speech-bubble"
        style={{ opacity: hovered && state === "ready" ? 1 : 0 }}
        aria-hidden="true"
      >
        I pinch 🦞
      </div>

      {/* ── Snap flash ── */}
      {snapFlash && (
        <div className="vrm-snap-flash" aria-hidden="true">
          *SNAP*
        </div>
      )}

      {/* ── Loading spinner ── */}
      {state === "loading" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "rgba(180,220,255,0.7)",
        }}>
          loading…
        </div>
      )}

      {/* ── Error fallback ── */}
      {state === "error" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "rgba(180,220,255,0.5)",
        }}>
          ◈
        </div>
      )}
    </div>
  )
}
