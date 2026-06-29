// Lagrange Interpolation
export function lagrangeInterpolate(points, xEval) {
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const x = sortedPoints.map(p => p.x);
  const y = sortedPoints.map(p => p.y);
  
  return xEval.map(xVal => {
    let result = 0;
    for (let i = 0; i < sortedPoints.length; i++) {
      let term = y[i];
      for (let j = 0; j < sortedPoints.length; j++) {
        if (i !== j) {
          term *= (xVal - x[j]) / (x[i] - x[j]);
        }
      }
      result += term;
    }
    return result;
  });
}

// Newton's Divided Differences
export function newtonInterpolate(points, xEval) {
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const x = sortedPoints.map(p => p.x);
  const y = sortedPoints.map(p => p.y);
  const n = sortedPoints.length;
  
  // Build divided difference table
  const ddTable = Array(n).fill(null).map(() => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    ddTable[i][0] = y[i];
  }
  
  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      ddTable[i][j] = (ddTable[i+1][j-1] - ddTable[i][j-1]) / (x[i+j] - x[i]);
    }
  }
  
  // Build display table (same format as backend)
  const displayTable = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (j < n - i) {
        row.push(ddTable[i][j]);
      } else {
        row.push(null);
      }
    }
    displayTable.push(row);
  }
  
  // Evaluate
  const yEval = xEval.map(xVal => {
    let result = ddTable[0][0];
    let product = 1;
    for (let i = 1; i < n; i++) {
      product *= (xVal - x[i-1]);
      result += ddTable[0][i] * product;
    }
    return result;
  });
  
  return { yEval, ddTable: displayTable };
}

// Cubic Spline (simple implementation)
export function splineInterpolate(points, xEval) {
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const x = sortedPoints.map(p => p.x);
  const y = sortedPoints.map(p => p.y);
  const n = sortedPoints.length;
  
  const h = new Array(n-1);
  for (let i = 0; i < n-1; i++) {
    h[i] = x[i+1] - x[i];
  }
  
  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n-1; i++) {
    alpha[i] = (3 / h[i]) * (y[i+1] - y[i]) - (3 / h[i-1]) * (y[i] - y[i-1]);
  }
  
  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);
  
  for (let i = 1; i < n-1; i++) {
    l[i] = 2 * (x[i+1] - x[i-1]) - h[i-1] * mu[i-1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i-1] * z[i-1]) / l[i];
  }
  
  const b = new Array(n-1).fill(0);
  const c = new Array(n).fill(0);
  const d = new Array(n-1).fill(0);
  
  for (let j = n-2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j+1];
    b[j] = (y[j+1] - y[j]) / h[j] - h[j] * (c[j+1] + 2 * c[j]) / 3;
    d[j] = (c[j+1] - c[j]) / (3 * h[j]);
  }
  
  // Build coefficients
  const coefficients = [];
  for (let i = 0; i < n-1; i++) {
    coefficients.push({
      segment: i,
      x_start: x[i],
      x_end: x[i+1],
      a: y[i],
      b: b[i],
      c: c[i],
      d: d[i]
    });
  }
  
  // Evaluate
  const yEval = xEval.map(xVal => {
    let i = 0;
    while (i < n-1 && xVal > x[i+1]) {
      i++;
    }
    if (i === n-1) {
      i--;
    }
    const dx = xVal - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  });
  
  return { yEval, coefficients };
}

// Helper functions for metrics
export function computeMetrics(points, interpolatedX, interpolatedY) {
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const x = sortedPoints.map(p => p.x);
  const y = sortedPoints.map(p => p.y);
  
  // Linear reference
  const linearInterp = (xVal) => {
    let i = 0;
    while (i < x.length - 1 && xVal > x[i+1]) {
      i++;
    }
    if (i === x.length - 1) {
      return y[x.length - 1];
    }
    const t = (xVal - x[i]) / (x[i+1] - x[i]);
    return y[i] * (1 - t) + y[i+1] * t;
  };
  
  const yRef = interpolatedX.map(xVal => linearInterp(xVal));
  
  // RMSE
  let rmse = 0;
  for (let i = 0; i < interpolatedX.length; i++) {
    rmse += Math.pow(interpolatedY[i] - yRef[i], 2);
  }
  rmse = Math.sqrt(rmse / interpolatedX.length);
  
  // Max deviation
  let maxDev = 0;
  for (let i = 0; i < interpolatedX.length; i++) {
    const dev = Math.abs(interpolatedY[i] - yRef[i]);
    if (dev > maxDev) {
      maxDev = dev;
    }
  }
  
  // Smoothness (mean absolute second derivative)
  let smoothness = 0;
  let count = 0;
  for (let i = 1; i < interpolatedX.length - 1; i++) {
    const dx1 = interpolatedX[i] - interpolatedX[i-1];
    const dx2 = interpolatedX[i+1] - interpolatedX[i];
    const dy1 = interpolatedY[i] - interpolatedY[i-1];
    const dy2 = interpolatedY[i+1] - interpolatedY[i];
    const secondDeriv = 2 * (dy2 / dx2 - dy1 / dx1) / (dx1 + dx2);
    smoothness += Math.abs(secondDeriv);
    count++;
  }
  smoothness = count > 0 ? smoothness / count : 0;
  
  return { rmse, maxDev, smoothness };
}
