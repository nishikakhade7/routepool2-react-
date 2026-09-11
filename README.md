# RoutePool — React + Express Ride-Pooling App

## Quick Start (No PostgreSQL needed)

### Terminal 1 — Backend
```bash
cd backend
npm install
npm run dev
# Backend starts on http://localhost:4000
```

### Terminal 2 — Frontend
```bash
cd frontend-react
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Login Flow
1. Enter your SPIT email username (the part before `@spit.ac.in`)
2. Click **Send verification code**
3. A yellow dev-hint box will show the OTP code (e.g. `Dev OTP: 1234`)
4. Enter the code using the on-screen numpad
5. Click ✓ to verify

**Pre-seeded test accounts:**
- `nishika.khade` (Nishika Khade)
- `rhea.menon` (Rhea Menon)
- `kabir.shetty` (Kabir Shetty)
- `ananya.deshpande` (Ananya Deshpande)

---

## Architecture
- **Frontend**: React 19 + Vite + React Router 7 (`frontend-react/`)
- **Backend**: Express 4 + Zod validation (`backend/`)
- **Database**: In-memory mock (no PostgreSQL needed with `USE_MOCK_DB=true`)

## Configuration
The `backend/.env` file has `USE_MOCK_DB=true` which enables the in-memory database.  
To use a real PostgreSQL database, set `USE_MOCK_DB=false` and update `DATABASE_URL`.
