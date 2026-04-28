# Travel Management System (TMS)

## Project Overview
The Travel Management System (TMS) is a full-stack web application designed to streamline the travel management lifecycle, including trip planning, itinerary management, expense tracking, approvals, and reporting.

The system provides role-based functionality for users and administrators through an integrated Angular frontend, Node.js/Express backend, and MySQL database.

## Live Application
Deployed Application:  
https://travel-ms-swe.vercel.app/

---

# Features

## User Features
- User Registration and Login
- Secure Authentication
- Plan Trips
- Create and Manage Itineraries
- Track Travel Expenses
- View Trips
- Budget Monitoring

## Admin Features
- Manage Users
- Approve or Reject Trips
- Generate Reports
- View Travel Analytics

## Additional Features
- Search and Filtering
- Role-Based Access Control
- Session Management
- Cloud Database Integration
- Responsive User Interface

---

# Tech Stack

## Frontend
- Angular
- TypeScript
- HTML
- CSS

## Backend
- Node.js
- Express.js

## Database
- MySQL
- Railway (Cloud Hosted)

## Deployment
- Vercel (Frontend)
- Cloud Hosted Backend
- Railway MySQL

---

# Project Structure

```text
project-root/
├── frontend/
│   ├── src/app/components/
│   ├── src/app/services/
│   ├── src/app/pages/
│   └── routing/
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── server.js
└── database/
    └── schema.sql
```

## Installation and Local Setup

### Prerequisites
- Node.js
- npm
- Angular CLI
- MySQL

### Database Setup
Run:
```sql
schema.sql
```

### Backend Setup
```bash
cd backend
npm install
node server.js
```

### Frontend Setup
```bash
cd frontend
npm install
ng serve
```

Local URL:
http://localhost:4200

## Environment Variables
```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
API_PORT=
```

## Major API Endpoints
- POST /register
- POST /login
- GET/POST/PUT /trips
- GET/POST/PUT /expenses
- GET /reports
- PUT /approve-trip

## Testing
Covers:
- Registration/Login
- Trip Creation
- Expense Tracking
- Admin Approval Workflow
- Reporting
- Edge cases and validation
- Full integration testing

## Deployment
Production deployment supports:
Frontend ↔ Backend APIs ↔ Cloud MySQL Database

Live URL:
https://travel-ms-swe.vercel.app/

## Challenges Addressed
- Frontend-backend integration
- Cloud database connectivity
- Role-based admin workflows
- Query optimization
- Validation and error handling

## Future Enhancements
- Group collaboration enhancements
- Budget alerts and notifications
- Expanded reporting dashboards
- Map API integrations
- Mobile feature expansion

## Team Members
- Dhanush Annoji
- Sanaul Haque
- Anjali Bhave
- Nishad Sudhagar
- Haolin Lyu

## Repository
https://github.com/2u5hi/TravelMS_SWE

## Conclusion
The Travel Management System is a fully implemented and deployed full-stack application demonstrating integrated frontend, backend, and database functionality while satisfying project requirements.
