# MeloMath — Musical Interpolation Explorer

A full-stack web application that demonstrates numerical interpolation methods (Lagrange, Newton's Divided Differences, Cubic Spline) through interactive music synthesis!

## 🌟 Features

- **Two Modes**: Use standalone frontend (for Vercel-friendly!) or connect to Python backend!
- **Interactive Plotting**: Click to add musical notes as data points
- **Visualization**: See all 3 interpolation curves
- **Audio Playback**: Hear the mathematical difference between methods!
- **MIDI Support**: Upload MIDI files! (API mode only)
- **Presets**: Load preset musical patterns!

## 🚀 Deployment on Vercel

### Frontend-Only Mode (Recommended for Vercel)
Just deploy the frontend directory to Vercel! That's it!

In frontend mode, all interpolation happens in the browser.

### Full-Stack Mode
1. Deploy frontend and backend separately. See `backend/vercel.json` for backend deployment.

## Local Development
### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Then visit http://localhost:5173

## Tech Stack
### Frontend
- React + Vite
- Tailwind CSS
- Recharts
- Tone.js

### Backend
- FastAPI
- NumPy
- SciPy
- Music21
