import React, { useState, useEffect, useRef } from 'react'
import * as Tone from 'tone'

/**
 * Component for audio playback of interpolated curves
 * @param {Object} props
 * @param {Object} props.interpolationData - Interpolation results
 * @param {Array} props.activeMethods - Active interpolation methods
 */
function AudioPlayer({ interpolationData, activeMethods }) {
  const [playing, setPlaying] = useState(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const oscillatorRef = useRef(null)
  const transportRef = useRef(null)

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

  const playMethod = async (method) => {
    if (!interpolationData[method]) return

    await Tone.start()

    if (oscillatorRef.current) {
      oscillatorRef.current.dispose()
    }

    const data = interpolationData[method]
    const maxX = Math.max(...data.x_vals)
    const duration = maxX / playbackSpeed

    const osc = new Tone.Oscillator(440, 'sine').toDestination()
    oscillatorRef.current = osc

    const now = Tone.now()
    data.x_vals.forEach((x, i) => {
      const time = now + (x / playbackSpeed)
      osc.frequency.setValueAtTime(data.y_vals[i], time)
    })

    osc.start()
    setPlaying(method)

    setTimeout(() => {
      osc.stop()
      osc.dispose()
      setPlaying(null)
    }, duration * 1000 + 100)
  }

  const playOriginal = async () => {
    await Tone.start()

    if (oscillatorRef.current) {
      oscillatorRef.current.dispose()
    }

    const points = []
    activeMethods.forEach(method => {
      if (interpolationData[method]) {
        interpolationData[method].x_vals.forEach((x, i) => {
          points.push({ x, y: interpolationData[method].y_vals[i] })
        })
      }
    })

    if (points.length === 0) return

    const uniqueX = [...new Set(points.map(p => p.x))].sort((a, b) => a - b)
    const maxX = Math.max(...uniqueX)
    const duration = maxX / playbackSpeed

    const osc = new Tone.Oscillator(440, 'sine').toDestination()
    oscillatorRef.current = osc

    const now = Tone.now()
    uniqueX.forEach(x => {
      const point = points.find(p => p.x === x)
      if (point) {
        const time = now + (x / playbackSpeed)
        osc.frequency.setValueAtTime(point.y, time)
      }
    })

    osc.start()
    setPlaying('original')

    setTimeout(() => {
      osc.stop()
      osc.dispose()
      setPlaying(null)
    }, duration * 1000 + 100)
  }

  const playAllSequentially = async () => {
    await Tone.start()

    const methodsToPlay = ['original', ...activeMethods.filter(m => interpolationData[m])]
    
    for (const method of methodsToPlay) {
      await new Promise(resolve => {
        if (method === 'original') {
          playOriginal()
        } else {
          playMethod(method)
        }
        setTimeout(() => {
          if (oscillatorRef.current) {
            oscillatorRef.current.dispose()
          }
          setPlaying(null)
          resolve()
        }, 3000 / playbackSpeed)
      })
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const stopPlaying = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop()
      oscillatorRef.current.dispose()
      oscillatorRef.current = null
    }
    setPlaying(null)
  }

  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.dispose()
      }
    }
  }, [])

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Audio Player</h3>

      <div className="mb-4">
        <label className="text-sm text-gray-400 mr-3">Playback Speed:</label>
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="px-3 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded focus:outline-none"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
          <span className="font-medium">Original Points</span>
          <button
            onClick={playing === 'original' ? stopPlaying : playOriginal}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              playing === 'original'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            {playing === 'original' ? 'Stop' : 'Play'}
          </button>
        </div>

        {activeMethods.map(method => (
          interpolationData[method] && (
            <div
              key={method}
              className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]"
              style={{ borderLeftWidth: 4, borderLeftColor: methodColors[method] }}
            >
              <span className="font-medium">{methodNames[method]}</span>
              <button
                onClick={playing === method ? stopPlaying : () => playMethod(method)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  playing === method
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                {playing === method ? 'Stop' : 'Play'}
              </button>
            </div>
          )
        ))}
      </div>

      <div className="mt-4">
        <button
          onClick={playAllSequentially}
          disabled={playing !== null}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-300"
        >
          Play All Sequentially
        </button>
      </div>
    </div>
  )
}

export default AudioPlayer
