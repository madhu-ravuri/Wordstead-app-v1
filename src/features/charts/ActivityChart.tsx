import { formatCalendarDate } from '../../domain/dates'
import type { ChartPoint } from '../../domain/sparkline'

type Variant = 'row' | 'detail' | 'overall'

interface Geometry {
  width: number
  height: number
  padX: number
  padTop: number
  padBottom: number
  marker: number
}

const GEOMETRY: Record<Variant, Geometry> = {
  row: { width: 150, height: 48, padX: 8, padTop: 8, padBottom: 7, marker: 5.5 },
  detail: { width: 440, height: 220, padX: 18, padTop: 22, padBottom: 14, marker: 10 },
  overall: { width: 440, height: 250, padX: 18, padTop: 22, padBottom: 14, marker: 7 },
}

// Decorative only (§5.5 AC 5, §5.7 AC 9): equal heights at fixed spacing, unrelated to data.
const DECORATIVE_BAR_COUNT = 6

interface ActivityChartProps {
  points: readonly ChartPoint[]
  variant: Variant
  /** Accessible summary; omit for row sparklines whose summary lives in the row. */
  description?: string
}

function starPath(cx: number, cy: number, radius: number): string {
  const inner = radius * 0.45
  const corners = Array.from({ length: 10 }, (_, index) => {
    const r = index % 2 === 0 ? radius : inner
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`
  })
  return `M${corners.join('L')}Z`
}

function formatWords(count: number): string {
  return new Intl.NumberFormat().format(count)
}

export function ActivityChart({ points, variant, description }: ActivityChartProps) {
  const { width, height, padX, padTop, padBottom, marker } = GEOMETRY[variant]
  const plotWidth = width - padX * 2
  const plotHeight = height - padTop - padBottom
  const baseline = height - padBottom
  const peak = Math.max(0, ...points.map((point) => point.words))

  const coordinates = points.map((point, index) => ({
    point,
    x: points.length === 1 ? width / 2 : padX + (plotWidth * index) / (points.length - 1),
    y: peak === 0 ? baseline : baseline - (point.words / peak) * plotHeight,
  }))
  const linePath = coordinates
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join('')
  const showDecorations = variant !== 'row'
  const barWidth = (plotWidth / DECORATIVE_BAR_COUNT) * 0.5

  const svg = (
    <svg
      className="activity-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {showDecorations &&
        Array.from({ length: DECORATIVE_BAR_COUNT }, (_, index) => (
          <rect
            key={index}
            className="chart-decorative-bar"
            x={padX + (plotWidth / DECORATIVE_BAR_COUNT) * (index + 0.25)}
            y={padTop + plotHeight * 0.3}
            width={barWidth}
            height={plotHeight * 0.7}
            rx={2}
          />
        ))}
      <line className="chart-baseline-line" x1={padX} x2={width - padX} y1={baseline} y2={baseline} />
      {coordinates.length > 1 && <path className="chart-line" d={linePath} />}
      {coordinates
        .filter(({ point }) => point.hasActivity)
        .map(({ point, x, y }) =>
          variant === 'overall' ? (
            <circle key={point.date} className="chart-marker" data-date={point.date} cx={x} cy={y} r={marker} />
          ) : (
            <path key={point.date} className="chart-marker" data-date={point.date} d={starPath(x, y, marker)} />
          ),
        )}
    </svg>
  )

  if (variant === 'row') {
    return <span className="activity-chart activity-chart-row">{svg}</span>
  }

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <>
      <figure className={`activity-chart activity-chart-${variant}`} role="img" aria-label={description}>
        {peak > 0 && <span className="chart-peak">Peak {formatWords(peak)} words</span>}
        {svg}
        {first && last && (
          <figcaption className="chart-axis">
            {points.length > 1 && <span>{formatCalendarDate(first.date, { month: 'short', day: 'numeric' })}</span>}
            <span>Today</span>
          </figcaption>
        )}
      </figure>
      <table className="visually-hidden">
        <caption>Words written per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Words</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatCalendarDate(point.date)}</th>
              <td>{formatWords(point.words)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
