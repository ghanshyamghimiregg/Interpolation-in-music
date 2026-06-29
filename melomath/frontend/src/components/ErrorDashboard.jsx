import React from 'react'

/**
 * Component for displaying error metrics
 * @param {Object} props
 * @param {Object} props.data - Interpolation results
 * @param {Array} props.activeMethods - Active interpolation methods
 */
function ErrorDashboard({ data, activeMethods }) {
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

  if (!data || activeMethods.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Place points and run interpolation to see error analysis
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
      insights.push(`${methodNames[smoothest]} achieved the smoothest reconstruction.`)
    }
    
    if (mostAccurate) {
      insights.push(`${methodNames[mostAccurate]} was the most accurate.`)
    }
    
    if (rungesRisk) {
      insights.push(`Lagrange shows significant edge oscillations (Runge's phenomenon).`)
    }
    
    if (insights.length === 0) {
      return "All methods performed similarly."
    }
    
    return insights.join(' ')
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Error Analysis</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {methods.map(method => (
          <div
            key={method}
            className="p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]"
            style={{ borderLeftWidth: 4, borderLeftColor: methodColors[method] }}
          >
            <h4 className="font-semibold mb-3">{methodNames[method]}</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">RMSE:</span>
                <span className="font-mono">{data[method].rmse.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Deviation:</span>
                <span className="font-mono">{data[method].max_dev.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Smoothness:</span>
                <span className="font-mono">{data[method].smoothness.toFixed(4)}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {method === smoothest && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Smoothest
                </span>
              )}
              {method === mostAccurate && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  Most Accurate
                </span>
              )}
              {method === 'lagrange' && rungesRisk && (
                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                  Runge's Risk
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
        <h4 className="font-semibold mb-2">Insight</h4>
        <p className="text-gray-400">{generateInsight()}</p>
      </div>
    </div>
  )
}

export default ErrorDashboard
