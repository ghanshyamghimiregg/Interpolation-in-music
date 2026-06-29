from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from interpolation import lagrange_interpolate, newton_interpolate, spline_interpolate
import music21
from io import BytesIO

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note to frequency mapping (A4 = 440Hz)
NOTE_FREQS = {
    'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'G0': 24.50, 'G#0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
    'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
    'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
}

def freq_to_note(freq):
    """Convert frequency to nearest note name"""
    if freq < 16.35 or freq > 1975.53:
        return "N/A"
    notes = list(NOTE_FREQS.items())
    closest_note = min(notes, key=lambda x: abs(x[1] - freq))
    return closest_note[0]

class InterpolationRequest(BaseModel):
    points: List[dict]
    methods: List[str]
    resolution: int = 500

class MethodResult(BaseModel):
    x_vals: List[float]
    y_vals: List[float]
    rmse: float
    max_dev: float
    smoothness: float
    dd_table: Optional[List[List[Optional[float]]]] = None
    coefficients: Optional[List[dict]] = None

def compute_metrics(original_points, interpolated_x, interpolated_y):
    """Compute RMSE, max deviation, and smoothness"""
    # Sort original points
    sorted_points = sorted(original_points, key=lambda p: p['x'])
    x_orig = np.array([p['x'] for p in sorted_points])
    y_orig = np.array([p['y'] for p in sorted_points])
    
    # Create linear reference
    from scipy.interpolate import interp1d
    linear_interp = interp1d(x_orig, y_orig, kind='linear')
    y_ref = linear_interp(interpolated_x)
    
    # Compute RMSE
    rmse = float(np.sqrt(np.mean((np.array(interpolated_y) - y_ref)**2)))
    
    # Compute max deviation
    max_dev = float(np.max(np.abs(np.array(interpolated_y) - y_ref)))
    
    # Compute smoothness (mean of absolute second derivative)
    dx = np.diff(interpolated_x)
    dy = np.diff(interpolated_y)
    first_deriv = dy / dx
    ddy = np.diff(first_deriv)
    smoothness = float(np.mean(np.abs(ddy))) if len(ddy) > 0 else 0.0
    
    return rmse, max_dev, smoothness

@app.post("/api/interpolate")
async def interpolate(request: InterpolationRequest):
    points = [(p['x'], p['y']) for p in request.points]
    
    # Sort points by x
    sorted_points = sorted(points, key=lambda p: p[0])
    x_min = sorted_points[0][0]
    x_max = sorted_points[-1][0]
    
    x_eval = np.linspace(x_min, x_max, request.resolution).tolist()
    
    result = {}
    
    if 'lagrange' in request.methods:
        y_lagrange = lagrange_interpolate(sorted_points, x_eval)
        rmse, max_dev, smoothness = compute_metrics(request.points, x_eval, y_lagrange)
        result['lagrange'] = {
            'x_vals': x_eval,
            'y_vals': y_lagrange,
            'rmse': rmse,
            'max_dev': max_dev,
            'smoothness': smoothness
        }
    
    if 'newton' in request.methods:
        y_newton, dd_table = newton_interpolate(sorted_points, x_eval)
        rmse, max_dev, smoothness = compute_metrics(request.points, x_eval, y_newton)
        result['newton'] = {
            'x_vals': x_eval,
            'y_vals': y_newton,
            'rmse': rmse,
            'max_dev': max_dev,
            'smoothness': smoothness,
            'dd_table': dd_table
        }
    
    if 'spline' in request.methods:
        y_spline, coefficients = spline_interpolate(sorted_points, x_eval)
        rmse, max_dev, smoothness = compute_metrics(request.points, x_eval, y_spline)
        result['spline'] = {
            'x_vals': x_eval,
            'y_vals': y_spline,
            'rmse': rmse,
            'max_dev': max_dev,
            'smoothness': smoothness,
            'coefficients': coefficients
        }
    
    return result

@app.post("/api/upload-midi")
async def upload_midi(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        midi_stream = BytesIO(contents)
        score = music21.converter.parse(midi_stream)
        
        track = score.parts[0]
        notes = []
        offset = 0.0
        
        for element in track.flatten().notesAndRests:
            if isinstance(element, music21.note.Note):
                freq = element.pitch.frequency
                notes.append({
                    'x': offset,
                    'y': freq
                })
            offset += element.quarterLength
        
        # Scale time to 0-4 seconds
        if len(notes) > 0:
            max_offset = max(n['x'] for n in notes)
            if max_offset > 0:
                scale = 4.0 / max_offset
                for n in notes:
                    n['x'] *= scale
        
        track_name = track.partName if track.partName else "Untitled Track"
        
        return {
            'points': notes,
            'track_name': track_name
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse MIDI file: {str(e)}")

@app.get("/api/presets")
async def get_presets():
    # C Major Scale (C4 to C5)
    c_major_notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
    c_major_points = [
        {'x': i * (2 / 7), 'y': NOTE_FREQS[note]}
        for i, note in enumerate(c_major_notes)
    ]
    
    # Twinkle Twinkle
    twinkle_notes = ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4']
    twinkle_points = [
        {'x': i * 0.5, 'y': NOTE_FREQS[note]}
        for i, note in enumerate(twinkle_notes)
    ]
    
    # Sparse Random (musically reasonable)
    sparse_notes = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5']
    sparse_points = [
        {'x': i * 0.8, 'y': NOTE_FREQS[note]}
        for i, note in enumerate(sparse_notes)
    ]
    
    # Runge's Phenomenon
    runge_points = []
    for i in range(10):
        x = i * (4 / 9)
        y = 500 + 500 * np.sin(5 * x)
        runge_points.append({'x': x, 'y': float(y)})
    
    return {
        'presets': [
            {
                'name': 'C Major Scale',
                'points': c_major_points
            },
            {
                'name': 'Twinkle Twinkle',
                'points': twinkle_points
            },
            {
                'name': 'Sparse Random',
                'points': sparse_points
            },
            {
                'name': "Runge's Phenomenon",
                'points': runge_points
            }
        ]
    }
