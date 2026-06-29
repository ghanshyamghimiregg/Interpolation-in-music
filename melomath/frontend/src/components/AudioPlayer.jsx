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

  const methodStyles = {
    lagrange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', btn: 'bg-orange-600 hover:bg-orange-500' },
    newton: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', btn: 'bg-blue-600 hover:bg-blue-500' },
    spline: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', btn: 'bg-green-600 hover:bg-green-500' }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg 
            className="w-5 h-5 text-purple-400" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          Audio Player
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-purple-500"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
            <span className="font-medium text-gray-300">Original</span>
          </div>
          <button
            onClick={playing === 'original' ? stopPlaying : playOriginal}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              playing === 'original' 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {playing === 'original' ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
            {playing === 'original' ? 'Stop' : 'Play'}
          </button>
        </div>

        {activeMethods.map(method => {
          const style = methodStyles[method]
          return interpolationData[method] && (
            <div
              key={method}
              className={`flex items-center justify-between p-4 rounded-xl border ${style.bg} ${style.border}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.text.includes('orange') ? '#f97316' : style.text.includes('blue') ? '#3b82f6' : '#22c55e' }}></div>
                <span className={`font-medium ${style.text}`}>{methodNames[method]}</span>
              </div>
              <button
                onClick={playing === method ? stopPlaying : () => playMethod(method)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  playing === method 
                    ? 'bg-red-600 hover:bg-red-500' 
                    : style.btn
                }`}
              >
                {playing === method ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
                {playing === method ? 'Stop' : 'Play'}
              </button>
            </div>
          )
        })}
      </div>

      <div>
        <button
          onClick={playAllSequentially}
          disabled={playing !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/>
          </svg>
          Play All Sequentially
        </button>
      </div>
    </div>
  )
}

export default AudioPlayer
