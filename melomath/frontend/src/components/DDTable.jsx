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
        Place points and run interpolation to see the DD table
      </div>
    )
  }

  const table = data.dd_table

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Newton's Divided Difference Table</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-gray-400 mb-2">Divided differences table</caption>
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-400">x</th>
              {table[0].map((_, i) => (
                <th key={i} className="p-2 text-left text-gray-400">
                  {i === 0 ? 'f[x]' : i === 1 ? 'f[x,y]' : `f[${'x,y'.split(',').join(',')},...]`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={i} className="border-t border-[#2a2a2a]">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`p-2 ${i === j ? 'bg-[#1e3a5f] text-white font-semibold' : ''}`}
                  >
                    {cell === null ? '—' : cell.toFixed(4)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DDTable
