# JobTrack

A full-stack MERN application for tracking and managing job applications in one place.

## 🚀 Live Demo

👉 [Visit JobTrack](https://job-track-iota-five.vercel.app)

## 📌 Features

- User registration and login
- JWT-based authentication
- Secure password hashing using bcrypt
- Add job applications
- Edit job applications
- Delete job applications
- View all personal job applications
- Search jobs by company, role, or location
- Filter applications by status
- Pagination
- Dashboard statistics
- Protected routes
- User-specific job data
- Responsive user interface

## 🛠️ Tech Stack

### Frontend
- React.js
- React Router
- Axios
- Vite
- CSS

### Backend
- Node.js
- Express.js
- JWT
- bcryptjs
- Mongoose

### Database
- MongoDB Atlas

### Deployment
- Vercel — Frontend
- Render — Backend
- MongoDB Atlas — Database

## 📊 Job Statuses

JobTrack supports four application statuses:

- Applied
- Interview
- Offer
- Rejected

## 🏗️ Project Structure

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
