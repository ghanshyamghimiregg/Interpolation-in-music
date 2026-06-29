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
        Place points and run interpolation to see spline coefficients
      </div>
    )
  }

  const coeffs = data.coefficients

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Cubic Spline Coefficients</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-400">Segment</th>
              <th className="p-2 text-left text-gray-400">x Range</th>
              <th className="p-2 text-left text-gray-400">a</th>
              <th className="p-2 text-left text-gray-400">b</th>
              <th className="p-2 text-left text-gray-400">c</th>
              <th className="p-2 text-left text-gray-400">d</th>
            </tr>
          </thead>
          <tbody>
            {coeffs.map((coeff, i) => (
              <tr key={i} className="border-t border-[#2a2a2a] hover:bg-[#0f0f0f]">
                <td className="p-2">{coeff.segment}</td>
                <td className="p-2">
                  [{coeff.x_start.toFixed(2)}, {coeff.x_end.toFixed(2)}]
                </td>
                <td className="p-2 font-mono">{coeff.a.toFixed(4)}</td>
                <td className="p-2 font-mono">{coeff.b.toFixed(4)}</td>
                <td className="p-2 font-mono">{coeff.c.toFixed(4)}</td>
                <td className="p-2 font-mono">{coeff.d.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
        <h4 className="font-semibold mb-2">Coefficient Explanation</h4>
        <p className="text-gray-400 font-mono">
          S(x) = a + b(x − x<sub>i</sub>) + c(x − x<sub>i</sub>)<sup>2</sup> + d(x − x<sub>i</sub>)<sup>3</sup>
        </p>
        <p className="text-gray-500 text-sm mt-2">
          where x ∈ [x<sub>i</sub>, x<sub>i+1</sub>] for segment i
        </p>
      </div>
    </div>
  )
}

export default SplineCoeffTable
