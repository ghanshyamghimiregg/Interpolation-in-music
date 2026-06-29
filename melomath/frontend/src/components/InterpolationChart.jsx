import React from 'react'
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const NOTE_FREQS = {
  'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'G0': 24.50, 'G#0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
  'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
}

function freqToNote(freq) {
  const notes = Object.entries(NOTE_FREQS)
  const closest = notes.reduce((a, b) => Math.abs(b[1] - freq) < Math.abs(a[1] - freq) ? b : a)
  return closest[0]
}

/**
 * Component for displaying interpolation curves
 * @param {Object} props
 * @param {Object} props.interpolationData - Interpolation results
 * @param {Array} props.points - Original control points
 * @param {Array} props.activeMethods - Active interpolation methods
 * @param {boolean} props.isLoading - Loading state
 */
function InterpolationChart({ interpolationData, points, activeMethods, isLoading }) {
  const methodColors = {
    lagrange: '#f97316',
    newton: '#3b82f6',
    spline: '#22c55e'
  }

  const methodNames = {
    lagrange: 'Lagrange',
    newton: 'Newton',
    spline: 'Cubic Spline'
  }

  const chartData = []
  const allX = new Set()
  
  activeMethods.forEach(method => {
    if (interpolationData[method]) {
      interpolationData[method].x_vals.forEach(x => allX.add(x))
    }
  })
  
  const sortedX = Array.from(allX).sort((a, b) => a - b)
  
  sortedX.forEach(x => {
    const point = { x }
    activeMethods.forEach(method => {
      if (interpolationData[method]) {
        const index = interpolationData[method].x_vals.indexOf(x)
        if (index !== -1) {
          point[method] = interpolationData[method].y_vals[index]
        }
      }
    })
    chartData.push(point)
  })

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-[400px] bg-[#0f0f0f] rounded-lg"></div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Interpolation Curves</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="x"
            stroke="#666"
            tick={{ fill: '#999' }}
            label={{ value: 'Time (s)', position: 'bottom', fill: '#999' }}
          />
          <YAxis
            stroke="#666"
            tick={{ fill: '#999' }}
            label={{ value: 'Frequency (Hz)', angle: -90, position: 'left', fill: '#999' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            formatter={(value, name) => {
              if (methodNames[name]) {
                return [`${value.toFixed(1)} Hz (${freqToNote(value)})`, methodNames[name]]
              }
              return [value.toFixed(2), name]
            }}
          />
          <Legend wrapperStyle={{ color: '#999' }} />
          {activeMethods.map(method => (
            interpolationData[method] && (
              <Line
                key={method}
                type="monotone"
                dataKey={method}
                stroke={methodColors[method]}
                strokeWidth={2}
                dot={false}
                name={methodNames[method]}
              />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>

      {points.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Control Points</h4>
          <ResponsiveContainer width="100%" height={100}>
            <ScatterChart data={points} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="x" stroke="#666" tick={{ fill: '#999' }} />
              <YAxis stroke="#666" tick={{ fill: '#999' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }} />
              <Scatter data={points} fill="#ffffff" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default InterpolationChart
