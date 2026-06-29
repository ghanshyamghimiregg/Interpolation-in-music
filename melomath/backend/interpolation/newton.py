import numpy as np


def newton_interpolate(points, x_eval):
    """
    Perform Newton's Divided Differences interpolation from scratch.
    
    Args:
        points: List of (x, y) tuples representing control points
        x_eval: List of x values to evaluate the interpolant at
        
    Returns:
        Tuple of (interpolated y values, divided difference table)
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
    
    # Create divided difference table
    dd_table = []
    
    # First column: y values (f[x0], f[x1], ..., f[xn-1])
    dd_table.append(y.tolist())
    
    # Build the rest of the table
    for i in range(1, n):
        col = []
        for j in range(n - i):
            # Divided difference formula: f[xj, xj+1, ..., xj+i] = (f[xj+1, ..., xj+i] - f[xj, ..., xj+i-1]) / (xj+i - xj)
            numerator = dd_table[i-1][j+1] - dd_table[i-1][j]
            denominator = x[j+i] - x[j]
            col.append(numerator / denominator)
        dd_table.append(col)
    
    # Extract coefficients from the diagonal (first elements of each column)
    coefficients = [dd_table[i][0] for i in range(n)]
    
    # Evaluate Newton polynomial at x_eval
    y_eval = []
    for x_val in x_eval:
        # Start with the first coefficient
        result = coefficients[0]
        # Compute product term (x - x0)(x - x1)...(x - xk)
        product = 1.0
        for i in range(1, n):
            product *= (x_val - x[i-1])
            result += coefficients[i] * product
        y_eval.append(result)
    
    # Convert table to 2D list for frontend display
    # Make it triangular with None for missing values
    display_table = []
    for i in range(n):
        row = []
        for j in range(n):
            if j < len(dd_table) and i < len(dd_table[j]):
                row.append(dd_table[j][i])
            else:
                row.append(None)
        display_table.append(row)
    
    return y_eval, display_table
