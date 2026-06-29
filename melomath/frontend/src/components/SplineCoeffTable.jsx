import React from 'react'

/**
 * Component for displaying cubic spline coefficients
 * @param {Object} props
 * @param {Object} props.data - Spline interpolation data with coefficients
 */
function SplineCoeffTable({ data }) {
  if (!data || !data.coefficients) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
        </svg>
        <p className="text-lg">Add points and use Cubic Spline to see coefficients</p>
      </div>
    )
  }

  const coeffs = data.coefficients

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
        </svg>
        Cubic Spline Coefficients
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-left text-gray-400 font-medium">Segment</th>
              <th className="p-3 text-left text-gray-400 font-medium">x Range</th>
              <th className="p-3 text-left text-gray-400 font-medium">a</th>
              <th className="p-3 text-left text-gray-400 font-medium">b</th>
              <th className="p-3 text-left text-gray-400 font-medium">c</th>
              <th className="p-3 text-left text-gray-400 font-medium">d</th>
            </tr>
          </thead>
          <tbody>
            {coeffs.map((coeff, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-900/30 transition-colors">
                <td className="p-3 text-gray-300 font-medium">{coeff.segment}</td>
                <td className="p-3 text-gray-300 font-mono">
                  [{coeff.x_start.toFixed(2)}, {coeff.x_end.toFixed(2)}]
                </td>
                <td className="p-3 text-gray-300 font-mono">{coeff.a.toFixed(6)}</td>
                <td className="p-3 text-gray-300 font-mono">{coeff.b.toFixed(6)}</td>
                <td className="p-3 text-gray-300 font-mono">{coeff.c.toFixed(6)}</td>
                <td className="p-3 text-gray-300 font-mono">{coeff.d.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-5 bg-gray-900/30 rounded-2xl border border-gray-800">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Coefficient Explanation
        </h4>
        <p className="text-gray-300 font-mono text-lg mb-2">
          S(x) = a + b(x − x<sub>i</sub>) + c(x − x<sub>i</sub>)<sup>2</sup> + d(x − x<sub>i</sub>)<sup>3</sup>
        </p>
        <p className="text-gray-500 text-sm">
          where x ∈ [x<sub>i</sub>, x<sub>i+1</sub>] for segment i
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-green-400 font-mono font-semibold">a</span>
            <p className="text-gray-400 text-xs mt-1">Constant term (value at xᵢ)</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-green-400 font-mono font-semibold">b</span>
            <p className="text-gray-400 text-xs mt-1">Linear coefficient</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-green-400 font-mono font-semibold">c</span>
            <p className="text-gray-400 text-xs mt-1">Quadratic coefficient</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-green-400 font-mono font-semibold">d</span>
            <p className="text-gray-400 text-xs mt-1">Cubic coefficient</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SplineCoeffTable
