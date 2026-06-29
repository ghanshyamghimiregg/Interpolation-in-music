import React, { useCallback, useState } from 'react'
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
function NotePlotter({ points, setPoints, presets, loadPreset, onMidiUpload }) {
  const [selectedPreset, setSelectedPreset] = useState('')

  const handleClick = (e) => {
    if (points.length >= 12) {
      toast.warning('Maximum 12 points allowed')
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 4
    const y = 2000 - ((e.clientY - rect.top) / rect.height) * 1900

    setPoints([...points, { x: Math.max(0, Math.min(4, x)), y: Math.max(100, Math.min(2000, y)) }])
  }

  const handleDelete = (index) => {
    setPoints(points.filter((_, i) => i !== index))
  }

  const handleClear = () => {
    setPoints([])
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
      onMidiUpload(data.points)
      toast.success(`Loaded: ${data.track_name}`)
    } catch (error) {
      toast.error('Failed to parse MIDI file')
    }
  }, [onMidiUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/midi': ['.mid', '.midi'] }
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-400">Note Plotter</h3>
        <span className="text-sm text-gray-500">{points.length} / 12 points</span>
      </div>

      <div
        onClick={handleClick}
        className="bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] cursor-crosshair"
      >
        <ResponsiveContainer width="100%" height={250}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 4]}
              stroke="#666"
              tick={{ fill: '#999' }}
              label={{ value: 'Time (s)', position: 'bottom', fill: '#999' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[100, 2000]}
              stroke="#666"
              tick={{ fill: '#999' }}
              label={{ value: 'Frequency (Hz)', angle: -90, position: 'left', fill: '#999' }}
              tickFormatter={(value) => {
                const note = freqToNote(value)
                return `${value.toFixed(0)}\n${note}`
              }}
              width={80}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              formatter={(value, name) => {
                if (name === 'y') {
                  return [`${value.toFixed(1)} Hz (${freqToNote(value)})`, 'Frequency']
                }
                return [value.toFixed(2), name === 'x' ? 'Time' : name]
              }}
            />
            <Scatter data={points} fill="#ffffff" strokeWidth={2} stroke="#ffffff" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {points.length > 0 && (
        <div className="mt-3 space-y-2">
          {points.map((point, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded border border-[#2a2a2a]"
            >
              <span className="text-sm">
                {freqToNote(point.y)} • {point.x.toFixed(2)}s • {point.y.toFixed(1)}Hz
              </span>
              <button
                onClick={() => handleDelete(index)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-gray-600 transition-all duration-300"
        >
          Clear All
        </button>
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-gray-400 mb-2 block">Load Preset</label>
        <select
          value={selectedPreset}
          onChange={(e) => {
            const preset = presets.find(p => p.name === e.target.value)
            if (preset) {
              loadPreset(preset)
              setSelectedPreset(e.target.value)
            }
          }}
          className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-gray-500"
        >
          <option value="">Select a preset...</option>
          {presets.map(preset => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <div
          {...getRootProps()}
          className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-300 ${
            isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a2a2a] hover:border-gray-600'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-gray-400">Drop the MIDI file here...</p>
          ) : (
            <p className="text-gray-400">Drag & drop a MIDI file here, or click to select</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotePlotter
