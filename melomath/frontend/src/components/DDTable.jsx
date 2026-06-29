import React from 'react'

/**
 * Component for displaying Newton's Divided Difference table
 * @param {Object} props
 * @param {Object} props.data - Newton interpolation data with dd_table
 */
function DDTable({ data }) {
  if (!data || !data.dd_table) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/>
        </svg>
        <p className="text-lg">Add points and use Newton's method to see the DD table</p>
      </div>
    )
  }

  const table = data.dd_table

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm0 9h7v7h-7v-7zM4 13h7v7H4v-7z"/>
        </svg>
        Newton's Divided Difference Table
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-left text-gray-400 font-medium">x</th>
              {table[0]?.map((_, i) => (
                <th key={i} className="p-3 text-left text-gray-400 font-medium">
                  {i === 0 ? 'f[x]' : i === 1 ? 'f[x,y]' : `f[${'x,y'.repeat(i).slice(0, -1)}]`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-900/30">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`p-3 font-mono ${i === j ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-gray-300'}`}
                  >
                    {cell === null ? '—' : cell.toFixed(6)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <p className="text-sm text-blue-200">
          <svg className="inline w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          The highlighted diagonal contains the coefficients used in Newton's interpolating polynomial
        </p>
      </div>
    </div>
  )
}

export default DDTable
