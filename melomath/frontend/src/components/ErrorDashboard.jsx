import React from 'react'

/**
 * Component for displaying error metrics
 * @param {Object} props
 * @param {Object} props.data - Interpolation results
 * @param {Array} props.activeMethods - Active interpolation methods
 */
function ErrorDashboard({ data, activeMethods }) {
  const methodStyles = {
    lagrange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', color: '#f97316' },
    newton: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', color: '#3b82f6' },
    spline: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', color: '#22c55e' }
  }

  const methodNames = {
    lagrange: 'Lagrange',
    newton: 'Newton',
    spline: 'Cubic Spline'
  }

  if (!data || activeMethods.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.59l7.59.41V3h-8z"/>
        </svg>
        <p className="text-lg">Add points to see error analysis</p>
      </div>
    )
  }

  const methods = activeMethods.filter(m => data[m])
  
  // Find method with lowest smoothness (smoothest)
  const smoothest = methods.reduce((a, b) => 
    data[a].smoothness < data[b].smoothness ? a : b
  )
  
  // Find method with lowest RMSE (most accurate)
  const mostAccurate = methods.reduce((a, b) => 
    data[a].rmse < data[b].rmse ? a : b
  )
  
  // Check for Runge's phenomenon
  const rungesRisk = methods.includes('lagrange') && methods.includes('spline') && 
    data.lagrange.rmse > 2 * data.spline.rmse

  const generateInsight = () => {
    let insights = []
    
    if (smoothest) {
      insights.push(`<strong>${methodNames[smoothest]}</strong> achieved the smoothest reconstruction.`)
    }
    
    if (mostAccurate) {
      insights.push(`<strong>${methodNames[mostAccurate]}</strong> was the most accurate.`)
    }
    
    if (rungesRisk) {
      insights.push(`<strong>Lagrange</strong> shows significant edge oscillations (Runge's phenomenon).`)
    }
    
    if (insights.length === 0) {
      return 'All methods performed similarly.'
    }
    
    return insights.join(' ')
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
        Error Analysis
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {methods.map(method => {
          const style = methodStyles[method]
          const isSmoothest = method === smoothest
          const isMostAccurate = method === mostAccurate
          const isRungesRisk = method === 'lagrange' && rungesRisk
          
          return (
            <div
              key={method}
              className={`p-5 rounded-2xl border ${style.bg} ${style.border}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: style.color }}></div>
                  <h4 className={`text-lg font-semibold ${style.text}`}>{methodNames[method]}</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">RMSE</span>
                  <span className="font-mono text-white">{data[method].rmse.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Max Deviation</span>
                  <span className="font-mono text-white">{data[method].max_dev.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Smoothness</span>
                  <span className="font-mono text-white">{data[method].smoothness.toFixed(4)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {isSmoothest && (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                    <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Smoothest
                  </span>
                )}
                {isMostAccurate && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                    <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    Most Accurate
                  </span>
                )}
                {isRungesRisk && (
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
                    <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                    Runge's Risk
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-5 bg-gray-900/30 rounded-2xl border border-gray-800">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
          </svg>
          Insight
        </h4>
        <p className="text-gray-300" dangerouslySetInnerHTML={{ __html: generateInsight() }}></p>
      </div>
    </div>
  )
}

export default ErrorDashboard
