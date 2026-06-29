import numpy as np


def lagrange_interpolate(points, x_eval):
    """
    Perform Lagrange interpolation from scratch.
    
    Args:
        points: List of (x, y) tuples representing control points
        x_eval: List of x values to evaluate the interpolant at
        
    Returns:
        List of interpolated y values
    """
    if len(points) < 2:
        raise ValueError("At least 2 points are required for interpolation")
    
    # Extract x and y coordinates from points
    x = np.array([p[0] for p in points])
    y = np.array([p[1] for p in points])
    
    # Check for duplicate x values
    if len(np.unique(x)) != len(x):
        raise ValueError("Duplicate x values are not allowed")
    
    n = len(points)
    y_eval = []
    
    # For each evaluation point x_val
    for x_val in x_eval:
        # Initialize interpolated value
        L = 0.0
        
        # Compute each basis polynomial L_i(x_val)
        for i in range(n):
            # Initialize basis polynomial
            li = 1.0
            
            # Product over j ≠ i
            for j in range(n):
                if j != i:
                    # L_i(x) = product_{j≠i} (x - x_j) / (x_i - x_j)
                    li *= (x_val - x[j]) / (x[i] - x[j])
            
            # Add y_i * L_i(x) to the interpolant
            L += y[i] * li
        
        y_eval.append(L)
    
    return y_eval
