# TravelMS / Waypoint on GitHub

Repository: <https://github.com/lyu929/TravelMS>. The default branch is `master`.

The existing repository history and course source are retained. `TravelMS-main/` is the current, independently runnable Waypoint personal edition. The older split `frontend/` and `backend/` directories remain as the course baseline. Their original README is preserved in `docs/TRAVELMS_COURSE_BASELINE.md`; its deployment statements describe that older version.

## Clone and run the current version

```sh
git clone https://github.com/lyu929/TravelMS.git
cd TravelMS/TravelMS-main
npm ci
cp .env.example .env
```

Fill in your own MySQL connection in `.env`, start MySQL, then run:

```sh
npm run setup -- --demo
npm start
```

Open <http://127.0.0.1:4200>. The original split directories are not needed to run Waypoint.

Source, lockfiles, schema/migrations, tests, font licenses, course documents, fictional sample PDF and current demonstration screenshots are included. Real account records, sessions, receipt files from MySQL, `.env`, local backups, dependency directories and build/test output are not included. Existing passwords and local database contents remain on your computer. A new clone obtains fictional demo accounts through setup; transferring real data requires a separate private backup/recovery step.

On a new database, demo setup seeds San Francisco, Seattle, New York and Austin. Vancouver and Portland were manually created on the demonstration computer and are not copied by Git. To reproduce the presentation example, create a Vancouver trip with a USD 100 budget, approve it, record USD 85 and USD 35 expenses, add itinerary items and create a report, following the demo guide.

## Update this checkout later

From the repository root on `master`, first check the pending files:

```sh
git status
git pull --ff-only origin master
git add .
git diff --cached --stat
git commit -m "Describe the change"
git push origin master
```

If the pull fails because local edits or another person's changes require a merge, resolve that situation before pushing. Keep the existing remote history; do not use a force push to replace it. Ignored files that were already tracked need to be removed from Git tracking separately.

The repository is private at publication time. Uploading code does not by itself configure a deployment of the Waypoint app. See the app README for local setup and hosting limitations.
