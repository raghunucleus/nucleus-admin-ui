import { useId, type SVGAttributes } from "react"

import { cn } from "@/lib/utils"

import {
  NUCLEUS_CANVAS,
  NUCLEUS_MARK,
  NUCLEUS_MARK_SMALL,
  NUCLEUS_VIEWBOX,
  type NucleusElectron,
  type NucleusGradientStop,
  type NucleusLinearGradient,
  type NucleusPaletteKey,
} from "./nucleus-mark-geometry"

/**
 * Palette keys resolve to the `--nucleus-*` custom properties declared in
 * src/index.css — the artwork's colours on :root and a lifted set under .dark —
 * so the mark re-colours with the theme without any JS.
 */
const tone = (key: NucleusPaletteKey) => `var(--nucleus-${key})`

function Stops({ stops }: { stops: NucleusGradientStop[] }) {
  return (
    <>
      {stops.map((s) => (
        <stop
          key={`${s.offset}-${s.tone}`}
          offset={s.offset}
          style={{ stopColor: tone(s.tone) }}
        />
      ))}
    </>
  )
}

function LinearGrad({ id, g }: { id: string; g: NucleusLinearGradient }) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={g.x1}
      y1={g.y1}
      x2={g.x2}
      y2={g.y2}
    >
      <Stops stops={g.stops} />
    </linearGradient>
  )
}

/**
 * Invisible rect spanning the whole canvas. Placed first in each orbit group
 * so the group's fill-box is centred on the nucleus — the pivot CSS rotates
 * around (`transform-box: fill-box; transform-origin: center`). `view-box`
 * would not do: Chromium measures it from the viewport corner, not the viewBox
 * origin, and the electrons fly off their rings.
 */
function Pivot() {
  const half = NUCLEUS_CANVAS / 2
  return (
    <rect
      data-pivot=""
      x={-half}
      y={-half}
      width={NUCLEUS_CANVAS}
      height={NUCLEUS_CANVAS}
      fill="none"
    />
  )
}

function Electrons({ electrons }: { electrons: NucleusElectron[] }) {
  return (
    <>
      {electrons.map((e) => (
        <circle
          key={`${e.x}-${e.y}`}
          cx={e.x}
          cy={e.y}
          r={e.r}
          style={{ fill: tone(e.tone) }}
        />
      ))}
    </>
  )
}

export interface MarkSvgProps
  extends Omit<SVGAttributes<SVGSVGElement>, "width" | "height"> {
  /** Rendered width/height (px, or any CSS length). */
  size?: number | string
  /**
   * Loader mode: each ring revolves with its own electrons about the still
   * core, the inner one the other way (see `.nucleus-animated` in index.css).
   */
  animated?: boolean
  /** Simplified geometry that stays legible below ~32px. */
  small?: boolean
  title?: string
}

/**
 * The bare Nucleus atom as an inline SVG, drawn from the generated geometry so
 * it is pixel-identical to the favicons and app icons. Groups carry
 * `data-part` (`ring-outer`, `ring-inner`, `core`, `electrons`, and when
 * animated the `orbit-outer` / `orbit-inner` wrappers) — the contract the CSS
 * animation targets.
 */
export function MarkSvg({
  size = 36,
  animated = false,
  small = false,
  title = "Nucleus",
  className,
  ...rest
}: MarkSvgProps) {
  // useId() output carries punctuation that is awkward inside url(#…); strip it.
  const id = `nm${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const g = small ? NUCLEUS_MARK_SMALL : NUCLEUS_MARK
  const { outerPurple, outerOrange, innerPurple, innerBlend, core } = g.gradients
  // The small variant has no inner ring, so it never spins.
  const spin = animated && !!g.paths.innerPurple

  const ringOuter = (
    <g data-part="ring-outer" fill="none" strokeWidth={g.stroke} strokeLinecap="round">
      <path d={g.paths.outerPurple} stroke={`url(#${id}-op)`} />
      <path d={g.paths.outerOrange} stroke={`url(#${id}-oo)`} />
    </g>
  )
  const ringInner =
    g.paths.innerPurple && g.paths.innerBlend ? (
      <g data-part="ring-inner" fill="none" strokeWidth={g.stroke} strokeLinecap="round">
        <path d={g.paths.innerPurple} stroke={`url(#${id}-ip)`} />
        <path d={g.paths.innerBlend} stroke={`url(#${id}-ib)`} />
      </g>
    ) : null
  const coreCircle = (
    <circle data-part="core" cx={0} cy={0} r={g.coreRadius} fill={`url(#${id}-core)`} />
  )
  const electrons = (
    <g data-part="electrons">
      <Electrons electrons={g.electrons} />
    </g>
  )

  return (
    <svg
      viewBox={NUCLEUS_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", spin && "nucleus-animated", className)}
      {...rest}
    >
      <defs>
        <LinearGrad id={`${id}-op`} g={outerPurple} />
        <LinearGrad id={`${id}-oo`} g={outerOrange} />
        {innerPurple ? <LinearGrad id={`${id}-ip`} g={innerPurple} /> : null}
        {innerBlend ? <LinearGrad id={`${id}-ib`} g={innerBlend} /> : null}
        <radialGradient
          id={`${id}-core`}
          cx={core.cx}
          cy={core.cy}
          r={core.r}
          fx={core.fx}
          fy={core.fy}
        >
          <Stops stops={core.stops} />
        </radialGradient>
      </defs>

      {/* Animated: each ring travels with its own electrons, so a ring's gaps
          always sit where the logo puts them and the first frame is the logo. */}
      {spin ? (
        <>
          <g data-part="orbit-outer">
            <Pivot />
            {ringOuter}
            {electrons}
          </g>
          <g data-part="orbit-inner">
            <Pivot />
            {ringInner}
          </g>
          {coreCircle}
        </>
      ) : (
        <>
          {ringOuter}
          {ringInner}
          {coreCircle}
          {electrons}
        </>
      )}
    </svg>
  )
}

export interface NucleusMarkProps extends MarkSvgProps {
  /**
   * White rounded tile behind the mark (the app-icon treatment) — use on dark
   * or coloured surfaces where the deep purple would otherwise sink into the
   * background.
   */
  tile?: boolean
}

/** The Nucleus logo mark. */
export function NucleusMark({
  size = 36,
  tile = false,
  className,
  ...props
}: NucleusMarkProps) {
  if (!tile) return <MarkSvg size={size} className={className} {...props} />

  const inner = typeof size === "number" ? Math.round(size * 0.76) : "76%"
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[22%] bg-white shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <MarkSvg size={inner} {...props} />
    </span>
  )
}
