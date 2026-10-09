# JobTrack

JobTrack is a full-stack MERN application designed to help users track, organize, and manage their job applications through a centralized dashboard.

## Live Demo

[Visit JobTrack](https://job-track-iota-five.vercel.app)

## Features

- User registration and login
- JWT-based authentication
- Secure password hashing using bcrypt
- Create, edit, and delete job applications
- View and manage personal job applications
- Search applications by company, role, or location
- Filter applications by status
- Pagination for efficient data navigation
- Dashboard statistics for application tracking
- Protected routes and user-specific data access
- Responsive user interface

## Tech Stack

### Frontend
- React.js
- React Router
- Axios
- Vite
- CSS

### Backend
- Node.js
- Express.js
- JSON Web Tokens (JWT)
- bcryptjs
- Mongoose

### Database
- MongoDB Atlas

### Deployment
- Vercel — Frontend
- Render — Backend
- MongoDB Atlas — Database

## Application Statuses

JobTrack supports four application statuses:

- Applied
- Interview
- Offer
- Rejected

## Project Structure

```text
JobTracker/
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── .env
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── api.js
│   │   └── main.jsx
│   └── package.json
│
├── .gitignore
└── README.md
```
