import React, { useState, useCallback } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'

const API_BASE = 'http://localhost:8000/api'

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
 * Component for plotting musical notes as data points
 * @param {Object} props
 * @param {Array} props.points - Current points
 * @param {Function} props.setPoints - Function to update points
 * @param {Array} props.presets - List of presets
 * @param {Function} props.loadPreset - Function to load a preset
 * @param {Function} props.onMidiUpload - Callback for MIDI upload
 */
function NotePlotter({ points, setPoints, presets, loadPreset, onMidiUpload, useFrontendMode = true }) {
  const [selectedPreset, setSelectedPreset] = useState('')

  const handleClick = (e) => {
    if (points.length >= 12) {
      toast.warning('Maximum 12 points allowed')
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 4
    const y = 2000 - ((e.clientY - rect.top) / rect.height) * 1900

    const newPoint = { x: Math.max(0, Math.min(4, x)), y: Math.max(100, Math.min(2000, y)) }
    setPoints([...points, newPoint])
    toast.success('Point added!')
  }

  const handleDelete = (index) => {
    const newPoints = points.filter((_, i) => i !== index)
    setPoints(newPoints)
    toast.info('Point removed')
  }

  const handleClear = () => {
    setPoints([])
    toast.success('All points cleared')
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/upload-midi`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      onMidiUpload(data.points, data.trackName)
    } catch (error) {
      toast.error('Failed to parse MIDI file')
    }
  }, [onMidiUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/midi': ['.mid', '.midi'] }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg 
            className="w-4 h-4 text-gray-400" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            aria-hidden="true"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 16H5V5h14v14zM7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z"/>
          </svg>
          <h3 className="text-sm font-semibold text-gray-300">Note Plotter</h3>
        </div>
        <span className="text-sm text-gray-500 font-medium bg-gray-800 px-3 py-1 rounded-full">
          {points.length}/12
        </span>
      </div>

      <div
        onClick={handleClick}
        className="bg-gray-900/50 rounded-xl border border-gray-800 cursor-crosshair overflow-hidden transition-all duration-200 hover:border-gray-700"
      >
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 4]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Time (s)', position: 'bottom', fill: '#9CA3AF', fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[100, 2000]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Freq (Hz)', angle: -90, position: 'left', fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                const note = freqToNote(value)
                return `${value.toFixed(0)}\n${note}`
              }}
              width={70}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value, name) => {
                if (name === 'y') {
                  return [`${value.toFixed(1)} Hz (${freqToNote(value)})`, 'Frequency']
                }
                return [value.toFixed(2), name === 'x' ? 'Time' : name]
              }}
            />
            <Scatter 
              data={points} 
              fill="#8B5CF6" 
              stroke="#A78BFA" 
              strokeWidth={2}
            />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="px-4 py-2 bg-gray-900/80 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Click anywhere on the plot to add a point
          </p>
        </div>
      </div>

      {points.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {points.map((point, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 transition-all duration-200 hover:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-sm text-gray-300">
                  {freqToNote(point.y)} • {point.x.toFixed(2)}s • {point.y.toFixed(0)}Hz
                </span>
              </div>
              <button
                onClick={() => handleDelete(index)}
                className="text-gray-500 hover:text-red-400 transition-colors duration-200 text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleClear}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
          Clear All
        </button>
        <button
          onClick={() => {
            setSelectedPreset('')
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 border border-purple-500 rounded-lg text-sm font-medium transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Load Preset
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400">Choose a preset:</label>
        <select
          value={selectedPreset}
          onChange={(e) => {
            const preset = presets.find(p => p.name === e.target.value)
            if (preset) {
              loadPreset(preset)
              setSelectedPreset(e.target.value)
            }
          }}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
        >
          <option value="">Select a preset...</option>
          {presets.map(preset => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {!useFrontendMode && (
        <div
          {...getRootProps()}
          className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 ${
            isDragActive 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            {isDragActive ? (
              <p className="text-purple-400 text-sm">Drop the MIDI file here...</p>
            ) : (
              <p className="text-gray-500 text-sm">Drag &amp; drop a MIDI file here, or click to select</p>
            )}
          </div>
        </div>
      )}

      {useFrontendMode && (
        <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            MIDI upload is only available in API mode
          </p>
        </div>
      )}
    </div>
  )
}

export default NotePlotter
