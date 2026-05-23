# Setup

## Requirements
- Node.js 18+
- npm

## Install and run
```bash
npm install
npm start
```

Default port: `3000`

Use a different port if needed:
```bash
PORT=4000 npm start
```

## Local verification flow
1. Open `http://localhost:3000`
2. Sign in using the mock auth form
3. Complete onboarding or skip to the feed
4. Visit the main product routes:
   - `/app`
   - `/opportunities/job-1`
   - `/network`
   - `/profile`
   - `/tracker`

## API checks
```bash
curl -i http://localhost:3000/
curl -i -c cookies.txt -d "email=alex@example.com&fullName=Alex+Morgan&provider=linkedin" -X POST http://localhost:3000/auth/login
curl -i -b cookies.txt http://localhost:3000/api/session
curl -i -b cookies.txt http://localhost:3000/api/matches
curl -i -b cookies.txt http://localhost:3000/api/graph
```

## Notes
- Sessions are stored in memory and reset when the server restarts.
- Profile edits are stored in the current in-memory session only.
- The app is intentionally dependency-light and does not yet use a database.
- Network review buttons are present as MVP scaffolding but do not persist changes yet.
