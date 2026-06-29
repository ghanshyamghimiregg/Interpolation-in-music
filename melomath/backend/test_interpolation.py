
from interpolation import lagrange_interpolate, newton_interpolate, spline_interpolate
import numpy as np

# Test points
test_points = [(0, 261.63), (1, 329.63), (2, 392.00)]
x_eval = np.linspace(0, 2, 5).tolist()

print("Testing Lagrange...")
try:
    y_lagrange = lagrange_interpolate(test_points, x_eval)
    print("Success:", y_lagrange)
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()

print("\nTesting Newton...")
try:
    y_newton, dd_table = newton_interpolate(test_points, x_eval)
    print("Success:", y_newton)
    print("DD Table:", dd_table)
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()

print("\nTesting Spline...")
try:
    y_spline, coeffs = spline_interpolate(test_points, x_eval)
    print("Success:", y_spline)
    print("Coefficients:", coeffs)
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
