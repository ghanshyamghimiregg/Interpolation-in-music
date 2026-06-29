import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import NotePlotter from './components/NotePlotter'
import InterpolationChart from './components/InterpolationChart'
import AudioPlayer from './components/AudioPlayer'
import ErrorDashboard from './components/ErrorDashboard'
import DDTable from './components/DDTable'
import SplineCoeffTable from './components/SplineCoeffTable'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [points, setPoints] = useState([])
  const [interpolationData, setInterpolationData] = useState({})
  const [activeMethods, setActiveMethods] = useState(['lagrange', 'newton', 'spline'])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('visualization')
  const [presets, setPresets] = useState([])

  useEffect(() => {
    fetchPresets()
  }, [])

  useEffect(() => {
    if (points.length >= 2) {
      performInterpolation()
    }
  }, [points, activeMethods])

  const fetchPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/presets`)
      const data = await response.json()
      setPresets(data.presets)
    } catch (error) {
      toast.error('Failed to fetch presets')
    }
  }

  const performInterpolation = async () => {
    if (points.length < 2 || activeMethods.length === 0) {
      setInterpolationData({})
      return
    }

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
      toast.error('Failed to perform interpolation')
    } finally {
      setIsLoading(false)
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
  }

  const handleMidiUpload = (uploadedPoints) => {
    setPoints(uploadedPoints)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="border-b border-[#2a2a2a] px-8 py-6">
        <h1 className="text-4xl font-bold text-white">MeloMath</h1>
        <p className="text-gray-400 mt-1">Hear the math. Feel the difference.</p>
      </div>

      <div className="flex">
        <div className="w-[30%] border-r border-[#2a2a2a] p-6">
          <NotePlotter
            points={points}
            setPoints={setPoints}
            presets={presets}
            loadPreset={loadPreset}
            onMidiUpload={handleMidiUpload}
          />

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Interpolation Methods</h3>
            <div className="space-y-2">
              {[
                { id: 'lagrange', name: 'Lagrange', color: '#f97316' },
                { id: 'newton', name: 'Newton', color: '#3b82f6' },
                { id: 'spline', name: 'Cubic Spline', color: '#22c55e' }
              ].map(method => (
                <label
                  key={method.id}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer transition-all duration-300 hover:border-gray-600"
                >
                  <input
                    type="checkbox"
                    checked={activeMethods.includes(method.id)}
                    onChange={() => toggleMethod(method.id)}
                    className="w-4 h-4"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: method.color }}
                  />
                  <span>{method.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="w-[70%] p-6">
          <div className="flex space-x-2 mb-6">
            {[
              { id: 'visualization', name: 'Visualization' },
              { id: 'dd-table', name: 'DD Table' },
              { id: 'spline-coeff', name: 'Spline Coefficients' },
              { id: 'error', name: 'Error Analysis' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6">
            {activeTab === 'visualization' && (
              <>
                <InterpolationChart
                  interpolationData={interpolationData}
                  points={points}
                  activeMethods={activeMethods}
                  isLoading={isLoading}
                />
                <div className="mt-6">
                  <AudioPlayer interpolationData={interpolationData} activeMethods={activeMethods} />
                </div>
              </>
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
      </div>
    </div>
  )
}

export default App
