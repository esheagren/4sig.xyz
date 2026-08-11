type OrbVideoOptions = {
  score: number
  durationMs?: number
  fps?: number
  size?: number
}

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return null
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function drawOrbFrame(ctx: CanvasRenderingContext2D, t: number, size: number, score: number) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38

  ctx.clearRect(0, 0, size, size)

  // Soft vignette background (transparent outside orb so it "sticks" nicely over anything)
  const vignette = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.35)
  vignette.addColorStop(0, 'rgba(10, 6, 20, 0.00)')
  vignette.addColorStop(1, 'rgba(10, 6, 20, 0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)

  // Clip to orb circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  // Base orb gradient
  const base = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.25, r * 0.1, cx, cy, r * 1.05)
  base.addColorStop(0, 'rgba(30, 18, 60, 0.95)')
  base.addColorStop(0.55, 'rgba(10, 6, 20, 0.95)')
  base.addColorStop(1, 'rgba(4, 2, 10, 0.98)')
  ctx.fillStyle = base
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // "Cool flame" blobs inside orb (deterministic motion)
  ctx.filter = `blur(${Math.round(size * 0.07)}px)`
  ctx.globalCompositeOperation = 'screen'

  const blobCount = 7
  for (let i = 0; i < blobCount; i++) {
    const phase = i * 0.9
    const speed = 0.6 + i * 0.07
    const time = t * speed + phase

    // Rising motion with licks
    const lick = 0.55 + 0.45 * Math.sin(time * 1.15 + i * 0.4)
    const lick2 = 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.1)
    const liftFactor = clamp01(0.2 + 0.8 * (0.6 * lick + 0.4 * lick2))

    const x = cx + Math.sin(time * 0.7 + i) * (r * 0.22) + Math.sin(time * 1.4 + i * 0.6) * (r * 0.08)
    const y = cy + r * 0.55 - liftFactor * (r * 0.9) + Math.sin(time * 1.6 + i * 1.3) * (r * 0.04)

    const hue = (140 + i * 18 + Math.sin(time * 0.35) * 10) % 360
    const sat = 80
    const light = 60
    const alpha = 0.25 + 0.35 * liftFactor

    const blobR = r * (0.55 + 0.25 * Math.sin(time * 1.3 + i))
    const g = ctx.createRadialGradient(x, y, 0, x, y, blobR)
    g.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`)
    g.addColorStop(0.35, `hsla(${hue}, ${sat}%, ${light - 6}%, ${alpha * 0.7})`)
    g.addColorStop(0.7, `hsla(${hue + 20}, ${sat - 10}%, ${light - 12}%, ${alpha * 0.35})`)
    g.addColorStop(1, `hsla(${hue}, ${sat - 15}%, ${light - 18}%, 0)`)

    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, blobR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'

  // Subtle specular highlight
  const hl = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.35, r * 0.05, cx - r * 0.25, cy - r * 0.35, r * 0.85)
  hl.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
  hl.addColorStop(0.25, 'rgba(255, 255, 255, 0.08)')
  hl.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hl
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  ctx.restore() // end clip

  // Orb rim glow
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = 'rgba(140, 120, 255, 0.25)'
  ctx.lineWidth = Math.max(2, size * 0.01)
  ctx.beginPath()
  ctx.arc(cx, cy, r + ctx.lineWidth * 0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Score text (keeps the asset meaningful even as a standalone video)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 12
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `700 ${Math.round(size * 0.11)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`
  ctx.fillText(String(Math.round(score)), cx, cy + r * 0.05)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(210,210,255,0.75)'
  ctx.font = `600 ${Math.round(size * 0.035)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`
  ctx.fillText('4-σ', cx, cy - r * 0.22)
  ctx.restore()
}

/**
 * Generates an animated orb as a short WebM video using MediaRecorder.
 * Returns null if the browser doesn't support the required APIs.
 */
export async function generateOrbWebm(options: OrbVideoOptions): Promise<Blob | null> {
  const mimeType = pickSupportedMimeType()
  if (!mimeType) return null

  const durationMs = options.durationMs ?? 3000
  const fps = options.fps ?? 30
  const size = options.size ?? 720

  // Best-effort: avoid capturing before fonts are ready (affects text metrics)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontsReady = (document as any).fonts?.ready
  if (fontsReady && typeof fontsReady.then === 'function') {
    try {
      await fontsReady
    } catch {
      // ignore
    }
  }

  const canvas = document.createElement('canvas')
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)) // cap for size/file
  canvas.width = Math.floor(size * dpr)
  canvas.height = Math.floor(size * dpr)
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // @ts-expect-error - captureStream exists on HTMLCanvasElement in browsers that support MediaRecorder
  const stream: MediaStream | undefined = canvas.captureStream?.(fps)
  if (!stream) return null

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_000_000, // decent quality, small-ish file
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let t = 0
  const dt = 1 / fps
  const intervalMs = Math.round(1000 / fps)

  // Draw an initial frame before recording starts (avoids blank first frame)
  drawOrbFrame(ctx, t, size, options.score)

  recorder.start()

  const intervalId = window.setInterval(() => {
    t += dt
    drawOrbFrame(ctx, t, size, options.score)
  }, intervalMs)

  await new Promise<void>((resolve) => window.setTimeout(resolve, durationMs))

  window.clearInterval(intervalId)

  const stopped = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  recorder.stop()
  return await stopped
}








