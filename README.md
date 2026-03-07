# Dashboard App

QA / Management / Operator real-time dashboard.

## Demo Credentials (all passwords: `demo123`)

| Role       | Usernames                             |
|------------|---------------------------------------|
| Management | `manager1`, `manager2`                |
| QA         | `qa1`, `qa2`                          |
| Operator   | `operator1`, `operator2`, `operator3` |

## Local Setup

```bash
npm install
npm start
# Open http://localhost:3000
```

---

## Deploying to Render.com (Free)

1. Unzip and push the contents to a **new GitHub repo**
   - Make sure `package.json` is at the **root** of the repo (not inside a subfolder)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Use these settings:
   - **Root Directory:** *(leave completely blank)*
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click Deploy → you get a public URL like `https://your-app.onrender.com`

> ⚠️ Free tier sleeps after 15 min inactivity (30s wake-up). Upgrade to $7/mo for always-on.

## Deploying to Railway.app

1. Push to GitHub (same rules — `package.json` at root)
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select repo → Railway auto-detects Node.js and deploys

---

## Notes

- Data is **in-memory** — resets on server restart
- PDFs stored as base64 in RAM — fine for demo, use S3 for production
- All devices must hit the **same server URL** for real-time sync to work

## File Structure

```
package.json      ← must be at root
server.js         ← Express backend + SSE
README.md
.gitignore
public/
  api.js          ← shared API client
  pre_login.html  ← entry / login selection
  login.html      ← QA + Management login
  rfid-login.html ← Operator RFID login
  management.html ← Management dashboard
  qa.html         ← QA dashboard
  operator.html   ← Operator tablet dashboard
```
