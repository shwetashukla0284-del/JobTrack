# JobTrack frontend

React 19 + Vite single-page app. See the [project README](../README.md) for the
overview, setup and architecture.

```bash
npm install
npm run dev      # http://localhost:5173, talks to the API at VITE_API_URL
npm run lint
npm run build
```

`VITE_API_URL` is set in `.env.development` (local API) and `.env.production`
(deployed API). A value set in your hosting provider's environment overrides them.

| Folder / file | Purpose |
|---|---|
| `src/pages/` | One component per route (Dashboard, Analytics, Login, …) |
| `src/components/JobForm.jsx` | Shared add/edit form |
| `src/api.js` | Axios client: attaches the token, handles expired sessions, error messages |
| `src/auth.js` | Login session helpers (token storage and expiry check) |
| `src/constants.js` | Allowed statuses and sources, date helpers |
