# MeloMath — Musical Interpolation Explorer

A full-stack web application that demonstrates numerical interpolation methods through interactive music synthesis.

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts (visualization)
- Tone.js (audio synthesis)

### Backend
- Python 3
- FastAPI
- NumPy
- SciPy
- Music21

## Installation & Setup

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Features

### Interpolation Methods
- **Lagrange**: Full implementation from scratch
- **Newton's Divided Differences**: Full implementation with table display
- **Cubic Spline**: Using SciPy with coefficient extraction

### Interactive Features
- Click to add musical notes as data points
- Drag & drop MIDI files
- Load preset musical patterns (C Major Scale, Twinkle Twinkle, etc.)
- Listen to interpolated audio
- Visualize interpolation curves
- View error metrics (RMSE, smoothness)
- Explore Runge's phenomenon

## Project Structure

```
melomath/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NotePlotter.jsx
│   │   │   ├── InterpolationChart.jsx
│   │   │   ├── AudioPlayer.jsx
│   │   │   ├── ErrorDashboard.jsx
│   │   │   ├── DDTable.jsx
│   │   │   └── SplineCoeffTable.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── backend/
│   ├── interpolation/
│   │   ├── __init__.py
│   │   ├── lagrange.py
│   │   ├── newton.py
│   │   └── spline.py
│   ├── main.py
│   ├── midi_parser.py
│   └── requirements.txt
└── README.md
```

## License

MIT
