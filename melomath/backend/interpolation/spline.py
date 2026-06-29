import numpy as np
from scipy.interpolate import CubicSpline


def spline_interpolate(points, x_eval):
    """
    Perform Cubic Spline interpolation using scipy.
    
    Args:
        points: List of (x, y) tuples representing control points
        x_eval: List of x values to evaluate the interpolant at
        
    Returns:
        Tuple of (interpolated y values, coefficients for each segment)
    """
    if len(points) < 2:
        raise ValueError("At least 2 points are required for interpolation")
    
    # Extract x and y coordinates from points
    x = np.array([p[0] for p in points])
    y = np.array([p[1] for p in points])
    
    # Check for duplicate x values
    if len(np.unique(x)) != len(x):
        raise ValueError("Duplicate x values are not allowed")
    
    # Sort points by x
    sorted_indices = np.argsort(x)
    x_sorted = x[sorted_indices]
    y_sorted = y[sorted_indices]
    
    # Fit cubic spline
    cs = CubicSpline(x_sorted, y_sorted)
    
    # Evaluate
    y_eval = cs(x_eval)
    
    # Extract coefficients for each segment
    coefficients = []
    for i in range(len(x_sorted) - 1):
        # Cubic spline for segment i: S(x) = a + b(x - xi) + c(x - xi)^2 + d(x - xi)^3
        # cs.c has shape (4, n_segments) where cs.c[0] = d, cs.c[1] = c, cs.c[2] = b, cs.c[3] = a
        a = float(cs.c[3, i])
        b = float(cs.c[2, i])
        c = float(cs.c[1, i])
        d = float(cs.c[0, i])
        
        coefficients.append({
            "segment": i,
            "x_start": float(x_sorted[i]),
            "x_end": float(x_sorted[i+1]),
            "a": a,
            "b": b,
            "c": c,
            "d": d
        })
    
    return y_eval.tolist(), coefficients
