# Dashboard App

QA / Management / Operator real-time dashboard with RFID login simulation.

## Demo Credentials (all passwords: `demo123`)

| Role       | Usernames                          |
|------------|------------------------------------|
| Management | `manager1`, `manager2`             |
| QA         | `qa1`, `qa2`                       |
| Operator   | `operator1`, `operator2`, `operator3` |

## Local Setup

```bash
npm install
npm start
# Open http://localhost:3000
```

For auto-reload during development:
```bash
npm run dev   # requires: npm install -g nodemon
```

---

## Hosting Options

### ✅ Option 1 — Render.com (Recommended, Free)

1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Deploy → get a public URL like `https://your-app.onrender.com`

> ⚠️ Free tier spins down after 15 min inactivity (takes ~30s to wake up).
> Upgrade to paid ($7/mo) for always-on.

### ✅ Option 2 — Railway.app (Free tier available)

1. Push to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select repo → Railway auto-detects Node.js
4. Add environment variable: `PORT=3000` (optional, Railway sets it automatically)
5. Deploy → get a public URL

### Option 3 — VPS / Self-hosted

```bash
# On your server (Ubuntu example)
git clone <your-repo>
cd dashboard-app
npm install
# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name dashboard
pm2 save
pm2 startup
```

---

## ⚠️ Important Notes

- **Data is in-memory** — resets when the server restarts. For production, replace the `store` object in `server.js` with a real database (SQLite, PostgreSQL, etc.)
- **No real authentication** — demo only. For production, add JWT tokens and hashed passwords.
- **PDF files** are stored in memory as base64 — large files will use lots of RAM. For production, use file storage (disk or S3).
- All pages must be served from the **same server** for real-time SSE to work.

## File Structure

```
dashboard-app/
├── server.js          ← Express backend + SSE + REST API
├── package.json
├── README.md
└── public/
    ├── api.js         ← Shared API client (loaded by all pages)
    ├── pre_login.html ← Entry point / login selection
    ├── login.html     ← QA + Management login
    ├── rfid-login.html← Operator RFID login
    ├── management.html← Management dashboard
    ├── qa.html        ← QA dashboard
    └── operator.html  ← Operator tablet dashboard
```
