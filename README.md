# Hole in the Wall

A full-stack starter project for a student-focused food deals platform.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Python + Flask
- Database: MongoDB
- CI: GitHub Actions
- Deployment target: AWS EC2 (backend) and optionally Vercel/static hosting (frontend)

## Project Structure

```text
hole-in-the-wall/
├── frontend/
│   ├── index.html
│   ├── about.html
│   ├── sign-in.html
│   ├── explore.html
│   ├── business.html
│   ├── portal.html
│   └── assets/
│       ├── css/styles.css
│       ├── js/app.js
│       ├── js/explore.js
│       ├── js/auth.js
│       ├── js/portal.js
│       └── images/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routes/
│   │   ├── auth.py
│   │   ├── businesses.py
│   │   └── deals.py
│   ├── services/
│   │   └── db.py
│   └── tests/
│       └── test_health.py
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── docker-compose.yml
└── sample.env
```

## What each part does
- `frontend/`: all public-facing pages and static assets
- `backend/`: Flask API, MongoDB connection, and business logic
- `.github/workflows/ci.yml`: runs lint/test checks on GitHub pushes
- `docker-compose.yml`: local development helper for MongoDB
- `sample.env`: environment variable template

## Local setup

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../sample.env .env
python app.py
```

### 2) MongoDB locally
```bash
docker compose up -d mongo
```

### 3) Frontend
Open `frontend/index.html` in a browser for static viewing, or serve it locally:
```bash
cd frontend
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## API endpoints included
- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/businesses`
- `GET /api/businesses/<id>`
- `POST /api/businesses`
- `GET /api/deals`
- `POST /api/deals`
- `POST /api/auth/register`
- `POST /api/auth/login`
- Student code verification:
  - `POST /api/auth/student/verify/start`
  - `POST /api/auth/student/verify/confirm`
- Business onboarding (code after admin approval):
  - `POST /api/business-inquiries`
  - `POST /api/business-inquiries/<id>/approve` (admin)
  - `POST /api/auth/business/verify/confirm`
- `GET /api/customer/preferences` (consumer/student)
- `PUT /api/customer/preferences` (consumer/student)
- `GET /api/customer/activity` (consumer/student)
- `POST /api/customer/log` (consumer/student)
- `GET /api/customer/saved-deals` (consumer/student)
- `POST /api/customer/save-deal` (consumer/student)

Protected actions:
- `POST /api/businesses` requires a logged-in `business` account
- `POST /api/deals` requires a logged-in `business` account

## Deployment plan
### Frontend
- Static hosting on Vercel, Netlify, or S3

### Backend
- Flask app on AWS EC2 with Gunicorn + Nginx
- MongoDB Atlas recommended for production database

## Next suggested features
- school email verification (`.edu`)
- claim/unclaim flow for restaurants
- map integration with Mapbox or Leaflet
- review system
- recommendation engine
