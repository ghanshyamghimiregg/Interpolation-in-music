import React, { useState, useEffect } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import NotePlotter from './components/NotePlotter'
import InterpolationChart from './components/InterpolationChart'
import AudioPlayer from './components/AudioPlayer'
import ErrorDashboard from './components/ErrorDashboard'
import DDTable from './components/DDTable'
import SplineCoeffTable from './components/SplineCoeffTable'
import {
  lagrangeInterpolate,
  newtonInterpolate,
  splineInterpolate,
  computeMetrics
} from './utils/interpolation'

const API_BASE = 'http://localhost:8000/api'

// Built-in presets (for frontend mode)
const BUILTIN_PRESETS = [
  {
    name: 'C Major Scale',
    points: [
      { x: 0, y: 261.63 },
      { x: 2/7, y: 293.66 },
      { x: 4/7, y: 329.63 },
      { x: 6/7, y: 349.23 },
      { x: 8/7, y: 392.00 },
      { x: 10/7, y: 440.00 },
      { x: 12/7, y: 493.88 },
      { x: 2, y: 523.25 }
    ]
  },
  {
    name: 'Twinkle Twinkle',
    points: [
      { x: 0, y: 261.63 },
      { x: 0.5, y: 261.63 },
      { x: 1, y: 392.00 },
      { x: 1.5, y: 392.00 },
      { x: 2, y: 440.00 },
      { x: 2.5, y: 440.00 },
      { x: 3, y: 392.00 }
    ]
  },
  {
    name: 'Sparse Random',
    points: [
      { x: 0, y: 261.63 },
      { x: 0.8, y: 329.63 },
      { x: 1.6, y: 392.00 },
      { x: 2.4, y: 523.25 },
      { x: 3.2, y: 659.25 },
      { x: 4, y: 783.99 }
    ]
  },
  {
    name: 'Runge\'s Phenomenon',
    points: Array.from({ length: 10 }, (_, i) => ({
      x: i * (4 / 9),
      y: 500 + 500 * Math.sin(5 * i * (4 / 9))
    }))
  }
]

function App() {
  const [points, setPoints] = useState([])
  const [interpolationData, setInterpolationData] = useState({})
  const [activeMethods, setActiveMethods] = useState(['lagrange', 'newton', 'spline'])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('visualization')
  const [presets, setPresets] = useState(BUILTIN_PRESETS) // Start with built-ins
  const [useFrontendMode, setUseFrontendMode] = useState(true) // Default to frontend

  useEffect(() => {
    // If we switch to API mode, try to fetch presets
    if (!useFrontendMode) {
      fetchPresets()
    } else {
      setPresets(BUILTIN_PRESETS)
    }
  }, [useFrontendMode])

  useEffect(() => {
    if (points.length >= 2) {
      performInterpolation()
    }
  }, [points, activeMethods, useFrontendMode])

  const fetchPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/presets`)
      const data = await response.json()
      setPresets(data.presets)
    } catch (error) {
      toast.warning('API not available, using built-in presets')
      setPresets(BUILTIN_PRESETS)
    }
  }

  const performInterpolation = async () => {
    if (points.length < 2 || activeMethods.length === 0) {
      setInterpolationData({})
      return
    }

    if (useFrontendMode) {
      // Frontend interpolation
      setIsLoading(true)
      try {
        const sortedPoints = [...points].sort((a, b) => a.x - b.x)
        const xMin = sortedPoints[0].x
        const xMax = sortedPoints[sortedPoints.length - 1].x
        const xEval = []
        const resolution = 500
        for (let i = 0; i < resolution; i++) {
          xEval.push(xMin + (i / (resolution - 1)) * (xMax - xMin))
        }

        const result = {}

        if (activeMethods.includes('lagrange')) {
          const yLagrange = lagrangeInterpolate(sortedPoints, xEval)
          const metrics = computeMetrics(sortedPoints, xEval, yLagrange)
          result.lagrange = {
            x_vals: xEval,
            y_vals: yLagrange,
            rmse: metrics.rmse,
            max_dev: metrics.maxDev,
            smoothness: metrics.smoothness
          }
        }

        if (activeMethods.includes('newton')) {
          const { yEval, ddTable } = newtonInterpolate(sortedPoints, xEval)
          const metrics = computeMetrics(sortedPoints, xEval, yEval)
          result.newton = {
            x_vals: xEval,
            y_vals: yEval,
            rmse: metrics.rmse,
            max_dev: metrics.maxDev,
            smoothness: metrics.smoothness,
            dd_table: ddTable
          }
        }

        if (activeMethods.includes('spline')) {
          const { yEval, coefficients } = splineInterpolate(sortedPoints, xEval)
          const metrics = computeMetrics(sortedPoints, xEval, yEval)
          result.spline = {
            x_vals: xEval,
            y_vals: yEval,
            rmse: metrics.rmse,
            max_dev: metrics.maxDev,
            smoothness: metrics.smoothness,
            coefficients
          }
        }

        setInterpolationData(result)
      } finally {
        setIsLoading(false)
      }
    } else {
      // API interpolation
      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE}/interpolate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            points,
            methods: activeMethods,
            resolution: 500
          })
        })
        const data = await response.json()
        setInterpolationData(data)
      } catch (error) {
        toast.error('Failed to connect to API, switching to frontend mode')
        setUseFrontendMode(true)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const toggleMethod = (method) => {
    setActiveMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    )
  }

  const loadPreset = (preset) => {
    setPoints(preset.points)
    toast.success(`Loaded "${preset.name}" preset!`)
  }

  const handleMidiUpload = (uploadedPoints, trackName) => {
    setPoints(uploadedPoints)
    toast.success(`Loaded MIDI: ${trackName}`)
  }

  const methodStyles = {
    lagrange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    newton: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    spline: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <ToastContainer 
        theme="dark" 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
      />
      
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-6 bg-[#0d0d0d]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <svg 
                className="w-6 h-6 text-purple-400" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
              MeloMath
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Hear the math. Feel the difference.</p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Mode:</span>
            <div className="flex bg-gray-900/70 rounded-lg p-1 border border-gray-800">
              <button
                onClick={() => setUseFrontendMode(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  useFrontendMode
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Frontend
              </button>
              <button
                onClick={() => setUseFrontendMode(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  !useFrontendMode
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                API
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-104px)]">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-gray-800 p-6 flex flex-col gap-6 bg-[#0d0d0d] overflow-y-auto">
          <NotePlotter
            points={points}
            setPoints={setPoints}
            presets={presets}
            loadPreset={loadPreset}
            onMidiUpload={handleMidiUpload}
            useFrontendMode={useFrontendMode}
          />

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
              </svg>
              Interpolation Methods
            </h3>
            <div className="space-y-2">
              {[
                { id: 'lagrange', name: 'Lagrange', color: '#f97316' },
                { id: 'newton', name: 'Newton', color: '#3b82f6' },
                { id: 'spline', name: 'Cubic Spline', color: '#22c55e' }
              ].map(method => {
                const style = methodStyles[method.id]
                const isActive = activeMethods.includes(method.id)
                
                return (
                  <label
                    key={method.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? `${style.bg} ${style.border} ${style.text}` 
                        : 'bg-gray-900/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleMethod(method.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: method.color }}
                    />
                    <span className="font-medium">{method.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex gap-2 p-1 bg-gray-900/50 rounded-xl w-fit">
              {[
                { id: 'visualization', name: 'Visualization' },
                { id: 'dd-table', name: 'DD Table' },
                { id: 'spline-coeff', name: 'Coefficients' },
                { id: 'error', name: 'Error' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gray-800 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 p-6 shadow-2xl">
              {activeTab === 'visualization' && (
                <div className="space-y-6">
                  <InterpolationChart
                    interpolationData={interpolationData}
                    points={points}
                    activeMethods={activeMethods}
                    isLoading={isLoading}
                  />
                  <AudioPlayer interpolationData={interpolationData} activeMethods={activeMethods} />
                </div>
              )}

              {activeTab === 'dd-table' && (
                <DDTable data={interpolationData.newton} />
              )}

              {activeTab === 'spline-coeff' && (
                <SplineCoeffTable data={interpolationData.spline} />
              )}

              {activeTab === 'error' && (
                <ErrorDashboard data={interpolationData} activeMethods={activeMethods} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
