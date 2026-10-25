# ⚙️ DoctorTracker – Backend REST API Server

A production-grade RESTful API service built with **Node.js**, **Express.js**, and **MongoDB Atlas** providing medical administration, JWT authentication, aggregation pipelines, and Gemini AI integration.

---

## 🔗 Submission Details

- **Backend GitHub Repository**: `https://github.com/ImtiazAhmed01/doctortracker-server-side`
- **Live Backend API URL**: `https://doctortracker-server-side.onrender.com`
- **Health Check Endpoint**: `https://doctortracker-server-side.onrender.com/health`

---

## 🩺 System Capabilities

- **Secure JWT Authentication**:
  - Email/password user registration and login with `bcryptjs` password hashing (12 salt rounds).
  - Exchange endpoint (`/api/auth/firebase`) for Firebase Google OAuth login tokens.
  - Express middleware (`verifyToken`) validating Bearer tokens on all sensitive routes.
- **Doctor Resource Management**:
  - CRUD operations with full data sanitization & validation (`express-validator`).
  - Regex-based multi-field search (`name`, `specialization`, `hospital`, `email`).
  - Multi-parameter filtering (date range, specialization) and server-side pagination.
  - Cascade deletion: deleting a doctor automatically cleans up all associated patient records.
- **Patient Resource Management**:
  - CRUD operations linking each patient directly to an assigned doctor ID.
  - Search by patient name or medical condition with status tracking (`Active`, `Discharged`, `Critical`).
- **Clinical Analytics & Aggregations**:
  - MongoDB aggregation pipelines powering the administrative dashboard:
    - Total doctors and patients count
    - Patient distribution per doctor
    - Medical conditions frequency breakdown
    - Monthly registration trends
- **Google Gemini AI Assistant Integration**:
  - `/api/chat` endpoint enriching conversational queries with live database statistics before calling Google's Gemini 1.5 Flash API.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas (`mongodb` Native Driver)
- **Security & Auth**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cors`
- **Validation**: `express-validator`
- **AI Integration**: `@google/genai` (Gemini 1.5 Flash)

---

## 📁 Project Structure

```
doctortrack server/
├── index.js          # Main application entry point & route definitions
├── .env.example      # Sample environment configuration template
├── package.json      # Dependencies and scripts
└── README.md         # Backend documentation
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** >= 18.x
- **MongoDB Atlas** cluster connection string
- **Google Gemini API Key** (optional, for chatbot functionality)

### 2. Installation
```bash
cd "doctortrack server"
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root of `doctortrack server`:

```env
PORT=5000
DB_user=your_mongodb_username
DB_pass=your_mongodb_password
JWT_SECRET=your_super_secret_jwt_key_here
CLIENT_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Running the Server
```bash
# Run with nodemon for hot-reload
npm run dev

# Or run with Node directly
npm start
```
The server will start on [http://localhost:5000](http://localhost:5000). You can verify its health at `http://localhost:5000/health`.

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/health` | Server uptime & status check | ❌ |
| `POST` | `/api/auth/register` | Register new administrative user | ❌ |
| `POST` | `/api/auth/login` | Login with email and password | ❌ |
| `POST` | `/api/auth/firebase` | Exchange Firebase OAuth token for JWT | ❌ |
| `GET` | `/api/dashboard/stats` | Aggregated clinical analytics & stats | ✅ |
| `GET` | `/api/doctors` | List doctors (search, filter, pagination) | ✅ |
| `GET` | `/api/doctors/:id` | Get individual doctor details | ✅ |
| `POST` | `/api/doctors` | Create new doctor profile | ✅ |
| `PUT` | `/api/doctors/:id` | Update doctor profile | ✅ |
| `DELETE` | `/api/doctors/:id` | Delete doctor & cascade delete patients | ✅ |
| `GET` | `/api/doctors/:id/patients`| List all patients under specific doctor | ✅ |
| `GET` | `/api/doctors/meta/specializations` | Get list of distinct specializations | ✅ |
| `GET` | `/api/patients` | List patients (search, filter, pagination) | ✅ |
| `GET` | `/api/patients/:id` | Get individual patient details | ✅ |
| `POST` | `/api/patients` | Create new patient record | ✅ |
| `PUT` | `/api/patients/:id` | Update patient record | ✅ |
| `DELETE` | `/api/patients/:id` | Delete patient record | ✅ |
| `GET` | `/api/patients/meta/conditions` | Get list of distinct conditions | ✅ |
| `POST` | `/api/chat` | MedBot AI interaction (Gemini Flash) | ✅ |

---

## 🌐 Deployment Instructions (e.g. Render / Railway)

1. Push the backend code to your GitHub repository.
2. In [Render](https://render.com), create a new **Web Service**.
3. Connect your repository and configure:
   - **Root Directory**: `doctortrack server` (or root if a dedicated repository)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the **Environment Variables**:
   - `PORT`: `5000` (or leave default assigned by host)
   - `DB_user`: your MongoDB database username
   - `DB_pass`: your MongoDB database password
   - `JWT_SECRET`: a secure random string
   - `CLIENT_URL`: your live frontend URL (e.g. `https://doctortracker-client.vercel.app`)
   - `GEMINI_API_KEY`: your Gemini API key
5. Deploy and test `/health` endpoint on your live service URL.
