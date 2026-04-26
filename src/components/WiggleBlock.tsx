import { useRef, useState, useCallback, useEffect, ReactNode } from "react"

interface WiggleBlockProps {
  /** Pass an imageUrl OR children — not both */
  imageUrl?: string
  alt?: string
  children?: ReactNode
  /** Optional real quilt for holographic agents */
  quiltUrl?: string
  quiltCols?: number
  quiltRows?: number
  quiltTileCount?: number
}

function useBootupWiggle() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

export default function WiggleBlock({
  imageUrl,
  alt = "",
  children,
  quiltUrl,
  quiltCols = 8,
  quiltRows = 6,
  quiltTileCount = 48,
}: WiggleBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerBottomRef = useRef<HTMLDivElement>(null)
  const layerTopRef = useRef<HTMLDivElement>(null)
  const isHologram = !!quiltUrl
  const mounted = useBootupWiggle()

  const [tilt, setTilt] = useState({ rotY: 0, rotX: 0, glareX: 50, glareY: 50, glareOp: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const setQuiltView = useCallback((viewValue: number) => {
    if (!quiltUrl || !layerBottomRef.current) return
    const clamped = Math.min(Math.max(1 - viewValue, 0), 1)
    const bottomIdx = Math.floor(clamped * (quiltTileCount - 1))
    const topIdx = Math.min(bottomIdx + 1, quiltTileCount - 1)
    const bottomCoords = [bottomIdx % quiltCols, quiltRows - 1 - Math.floor(bottomIdx / quiltCols)]
    const topCoords = [topIdx % quiltCols, quiltRows - 1 - Math.floor(topIdx / quiltCols)]
    const opacity = clamped * (quiltTileCount - 1) - bottomIdx
    const getStyle = (coords: number[], op: number) =>
      `width:calc(100%*${quiltCols});height:calc(100%*${quiltRows});` +
      `background-image:url("${quiltUrl}");background-size:100% 100%;` +
      `transform:translate(calc(-100%/${quiltCols}*${coords[0]}),calc(-100%/${quiltRows}*${coords[1]}));opacity:${op};`
    layerBottomRef.current.setAttribute("style", getStyle(bottomCoords, 1))
    if (layerTopRef.current) layerTopRef.current.setAttribute("style", getStyle(topCoords, opacity))
  }, [quiltUrl, quiltCols, quiltRows, quiltTileCount])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (isHologram) {
      setQuiltView(x)
    } else {
      setTilt({ rotY: (x - 0.5) * 22, rotX: (0.5 - y) * 14, glareX: x * 100, glareY: y * 100, glareOp: 0.18 })
    }
  }, [isHologram, setQuiltView])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (isHologram) setQuiltView(0.5)
    else setTilt({ rotY: 0, rotX: 0, glareX: 50, glareY: 50, glareOp: 0 })
  }, [isHologram, setQuiltView])

  useEffect(() => { if (isHologram) setQuiltView(0.5) }, [isHologram, setQuiltView])

  const imageTransform = isHovered
    ? `perspective(700px) rotateY(${tilt.rotY}deg) rotateX(${tilt.rotX}deg) scale(1.02)`
    : "perspective(700px) rotateY(0deg) rotateX(0deg) scale(1)"

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
    >
      {isHologram ? (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div ref={layerBottomRef} style={{ position: "absolute", top: 0, left: 0 }} />
          <div ref={layerTopRef} style={{ position: "absolute", top: 0, left: 0 }} />
        </div>
      ) : (
        <div
          className={mounted ? "wiggle-ready" : "wiggle-boot"}
          style={{
            width: "100%", height: "100%",
            transform: imageTransform,
            transition: isHovered ? "transform 0.06s ease-out" : "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)",
            transformOrigin: "center center",
            position: "relative",
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            children
          )}
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,${tilt.glareOp}) 0%, transparent 65%)`,
              pointerEvents: "none",
              transition: "background 0.06s ease-out",
            }}
          />
        </div>
      )}
    </div>
  )
}
