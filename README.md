# Portfolio Website

A dynamic personal portfolio built with Node.js + Express.

- **Home page**: your name, role, about, and skills, loaded from `data/profile.json`
- **Projects**: loaded from `data/projects.json`, with tag filters
- **Contact form**: messages are validated and saved on the server (with rate limiting and spam protection)
- **Admin inbox** at `/admin.html`: read, mark, and delete messages (password protected)
- Light and dark mode, and a layout that works on phones

## Run it locally

```bash
npm install
npm start
```

Open http://localhost:3000. Use `npm run dev` to restart automatically when you edit `server.js`.

To set the admin password (PowerShell):

```powershell
$env:ADMIN_PASSWORD="your-secret"; npm start
```

## Make it yours

All content is loaded from JSON files at request time, so edit a file and refresh: no restart needed.

| What | Where |
|---|---|
| Name, roles (typing effect), about, stats, skills, education, links | `data/profile.json` |
| Work experience timeline | `data/experience.json` |
| Projects (with category filter and status badge) | `data/projects.json` |
| Certifications | `data/certifications.json` |
| Colors and fonts | `public/styles.css` (`:root` variables) |

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Profile info |
| GET | `/api/experience` | Work experience |
| GET | `/api/certifications` | Certifications grouped by issuer |
| GET | `/api/projects?category=SOC&tag=Python` | Projects (optionally filtered) |
| POST | `/api/contact` | Send a message `{ name, email, message }` |
| GET | `/api/admin/messages` | List messages (header `x-admin-password`) |
| PATCH | `/api/admin/messages/:id` | Mark read/unread `{ read: true }` |
| DELETE | `/api/admin/messages/:id` | Delete a message |

## Deploy (free) on Render

1. Push this folder to a GitHub repository.
2. On https://render.com create a **New → Web Service** and pick the repo.
3. Build command: `npm install`  ·  Start command: `npm start`
4. Under **Environment**, add `ADMIN_PASSWORD` with a strong password.
5. Deploy. You'll get a URL like `https://your-portfolio.onrender.com`.

Railway, Fly.io, or any VPS works the same way (`npm install`, then `npm start`, and set `PORT` and `ADMIN_PASSWORD`).

> **Note:** Messages are stored in `data/messages.json`. On free hosting plans the disk is
> wiped on each redeploy or restart, so old messages may disappear. To keep them permanently,
> attach a persistent disk (Render → Disks, mounted at `/opt/render/project/src/data`) or switch
> the storage to a database such as MongoDB Atlas or PostgreSQL.
