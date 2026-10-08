# Soundscaper

Soundscaper is a professional, web-based audio design tool that dynamically generates and mixes soundscapes using the Freesound API. It features DAW-grade capabilities including graphical parametric EQ (FabFilter style), advanced LUFS loudness metering (Youlean style), and real-time waveform seeking.

## Prerequisites

- Node.js (v18 or higher recommended)
- A Freesound API Key (Get one at [freesound.org/apiv2](https://freesound.org/apiv2/))

## Installation & Running (Mac / Windows)

It is extremely easy to run Soundscaper locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ardaerenkaya/soundscaper.git
   cd soundscaper
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set up your API Key:**
   - Copy the `.env.example` file and rename it to `.env`
   - Open `.env` and paste your Freesound API Key:
     ```
     VITE_FREESOUND_API_KEY=your_actual_key_here
     ```

4. **Run the local development server:**
   ```bash
   npm run dev
   ```
   *Your browser should automatically open `http://localhost:5173`. If it doesn't, just click the link in your terminal.*

## Features

- **Generative Soundscapes:** Type a scene (e.g., "hospital room tone") and it automatically searches, downloads, and mixes layers.
- **Interactive Pro-Q Style EQ:** 5-band draggable parametric EQ with real-time spectrum overlay.
- **Advanced Loudness Metering:** Accurate LUFS (Momentary, Short-Term, Integrated) and True Peak metering.
- **Interactive Waveforms:** Click anywhere on a layer's stereo waveform to instantly seek audio perfectly synced with the Web Audio context.
- **Exporting:** Record your live mixing sessions or export the perfect loop to WAV, complete with CC0 attribution text files.

## Build for Production

If you want to build the static files to host on a web server:
```bash
npm run build
```
The optimized files will be generated in the `dist/` folder.

## Tech Stack
- React
- Vite
- Web Audio API (BiquadFilters, AnalyserNodes, custom LUFS approx math)
- Lucide React (Icons)
