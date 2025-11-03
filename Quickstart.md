# Quick Start

Ready to see the dashboard running locally? This checklist gets you there fast.

## 1. Backend (Django)
- `python -m venv .venv`
- `.venv\Scripts\activate` (use `source .venv/bin/activate` on macOS/Linux)
- `pip install -r requirements.txt`
- `python manage.py migrate`
- (Optional) `python manage.py createsuperuser`
- `python manage.py runserver`

The app listens on `http://127.0.0.1:8000/` by default.

## 2. Frontend (React + esbuild)
- `cd frontend`
- `npm install`
- `npm run dev` to rebuild assets on file changes (outputs to `devices/static/dashboard`)
- `npm run build` for a production bundle

## 3. Device discovery utilities
- `python manage.py discover_once` runs a single subnet scan and prints JSON results.
- Device discovery runs automatically on startup; tune the interval via `DEVICE_DISCOVERY_INTERVAL_SECONDS` in `homehub/settings.py`.

## 4. Environment variables
- `DJANGO_SECRET_KEY` — required for non-development deployments.
- `DJANGO_DEBUG` — set to `0` in production.
- `DJANGO_ALLOWED_HOSTS` — comma-delimited hostnames if you need more than `*`.

Once the backend server and frontend watcher are running, refresh the dashboard to see live device updates.

