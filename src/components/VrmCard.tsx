import { useEffect, useRef, useState } from "react"

interface VrmCardProps {
  vrmUrl: string
  alt: string
}

/**
 * Compact VRM viewer for gallery cards.
 * - Lazy-initialises Three.js only when the element enters the viewport
 * - Auto-rotates slowly; drag to spin on hover
 * - Falls back to a spinner until the model is ready
 */
export default function VrmCard({ vrmUrl, alt }: VrmCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")

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

      scene.add(new THREE.AmbientLight(0xffffff, 0.9))
      const dir = new THREE.DirectionalLight(0xffffff, 1.0)
      dir.position.set(1, 2, 2)
      scene.add(dir)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let model: any = null
      // Start at π so the model faces the camera (VRM default is -Z, camera is at +Z)
      let autoRotY = Math.PI

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

          // Fit camera distance so the model fills the frame (with 20% padding)
          const maxDim = Math.max(size.x, size.y, size.z)
          const fovRad = fovDeg * (Math.PI / 180)
          const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.2
          // Position camera slightly above center for a natural character angle
          camera.position.set(0, size.y * 0.05, dist)
          camera.lookAt(0, 0, 0)

          model = root
          setState("ready")
        },
        undefined,
        () => setState("error")
      )

      // Drag-to-rotate
      let dragging = false
      let dragX = 0
      let manualRotY = 0

      canvas.addEventListener("mousedown", e => { dragging = true; dragX = e.clientX })
      canvas.addEventListener("mousemove", e => {
        if (!dragging || !model) return
        manualRotY += (e.clientX - dragX) * 0.012
        dragX = e.clientX
      })
      const stopDrag = () => { dragging = false }
      canvas.addEventListener("mouseup", stopDrag)
      canvas.addEventListener("mouseleave", stopDrag)

      function animate() {
        if (cancelled) return
        animId = requestAnimationFrame(animate)
        if (model) {
          autoRotY += 0.004 // slow auto-spin
          model.rotation.y = autoRotY + manualRotY
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

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-subtle)" }}>
      {/* Canvas — always rendered so the ref is available when state→loading */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: state === "ready" || state === "loading" ? "block" : "none",
          cursor: "grab",
        }}
        aria-label={alt}
        title="Drag to rotate"
      />

      {/* Loading spinner */}
      {state === "loading" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--text-3)",
        }}>
          loading…
        </div>
      )}

      {/* Error fallback */}
      {state === "error" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--text-3)",
        }}>
          ◈
        </div>
      )}
    </div>
  )
}
