"use client"
import { useEffect, useRef } from "react"

interface VrmViewerProps {
  vrmUrl: string
  width?: number
  height?: number
}

// Dynamically loads Three.js + three-vrm in the browser only
export default function VrmViewer({ vrmUrl, width = 400, height = 400 }: VrmViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    let cancelled = false
    let animId: number

    async function init() {
      const THREE = await import("three")
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
      const { VRMLoaderPlugin } = await import("@pixiv/three-vrm")

      const canvas = canvasRef.current!
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.outputColorSpace = THREE.SRGBColorSpace

      const scene = new THREE.Scene()
      const fovDeg = 32
      const camera = new THREE.PerspectiveCamera(fovDeg, width / height, 0.1, 100)

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      const dirLight = new THREE.DirectionalLight(0xffffff, 1)
      dirLight.position.set(1, 2, 3)
      scene.add(ambientLight, dirLight)

      const loader = new GLTFLoader()
      loader.register(parser => new VRMLoaderPlugin(parser))

      // Start at π so model faces camera (VRM default is -Z, camera is at +Z)
      let rotY = Math.PI

      loader.load(vrmUrl, (gltf) => {
        if (cancelled) return
        const vrm = (gltf as any).userData.vrm
        const root = vrm ? vrm.scene : gltf.scene
        scene.add(root)

        // Center model at origin then auto-fit camera
        const box = new THREE.Box3().setFromObject(root)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        root.position.sub(center)

        const maxDim = Math.max(size.x, size.y, size.z)
        const fovRad = fovDeg * (Math.PI / 180)
        const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.15
        camera.position.set(0, size.y * 0.05, dist)
        camera.lookAt(0, 0, 0)
      }, undefined, (err) => console.warn("VRM load error", err))

      // Drag-to-rotate
      let isDragging = false
      let prevX = 0

      canvas.addEventListener("mousedown", e => { isDragging = true; prevX = e.clientX })
      canvas.addEventListener("mousemove", e => {
        if (!isDragging) return
        rotY += (e.clientX - prevX) * 0.01
        prevX = e.clientX
      })
      canvas.addEventListener("mouseup", () => { isDragging = false })
      canvas.addEventListener("mouseleave", () => { isDragging = false })

      function animate() {
        if (cancelled) return
        animId = requestAnimationFrame(animate)
        const model = scene.children.find(c => c.type !== "AmbientLight" && c.type !== "DirectionalLight")
        if (model) model.rotation.y = rotY
        renderer.render(scene, camera)
      }
      animate()
    }

    init().catch(console.error)

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
    }
  }, [vrmUrl, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: "1px solid #ccc", cursor: "grab", display: "block" }}
      title="Drag to rotate"
    />
  )
}
