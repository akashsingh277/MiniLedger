# MiniLedger — Personal Loan Tracker

MiniLedger is a mobile application for tracking money lent to friends. It helps users record loans, monitor repayment status, and identify overdue payments through a simple dashboard.

## Features

- **Phone OTP authentication** — mock OTP flow for development, with JWT-based authentication.
- **Loan management** — add loans with a friend's name, amount, and due date.
- **Repayment tracking** — mark loans as repaid and update the dashboard.
- **Financial summary** — view total lent, total repaid, and overdue amounts.
- **Overdue highlighting** — quickly identify unpaid loans past their due dates.
- **Persistent storage** — store user and loan data in PostgreSQL.

## Tech Stack

| Layer | Technologies |
|---|---|
| Mobile | React Native, Expo, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon) |
| Authentication | Mock OTP, JSON Web Tokens (JWT) |

## Project Structure

```text
MiniLedger/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── app.ts
│   │   ├── otp.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── mobile/
│   ├── assets/
│   ├── App.tsx
│   ├── app.json
│   └── package.json
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- Expo Go on a compatible mobile device
- A PostgreSQL database, such as Neon
- Git

### 1. Clone the repository

```bash
git clone https://github.com/akashsingh277/MiniLedger.git
cd MiniLedger
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_long_random_secret
OTP_TTL_MINUTES=5
```

Use your own database connection string and a strong, private JWT secret. Never commit `.env` files.

Start the backend:

```bash
npm run dev
```

The API runs on port `3000` by default.

### 3. Configure the mobile app

In a second terminal:

```bash
cd mobile
npm install
```

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
```

Replace `YOUR_COMPUTER_IP` with your computer's local IPv4 address. The phone and computer should be on the same Wi-Fi network. Do not use `localhost` for a physical phone.

Start Expo:

```bash
npx expo start
```

Scan the QR code using Expo Go.

### 4. Sign in during development

Enter a valid Indian mobile number. The mock OTP is printed in the backend terminal. Enter that code in the app to authenticate.

**Note:** The OTP implementation is intended for development and demonstration. A production deployment should use a real OTP provider, rate limiting, and additional authentication safeguards.

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check API health |
| `GET` | `/db-health` | Check database connectivity |
| `POST` | `/auth/send-otp` | Generate a mock OTP |
| `POST` | `/auth/verify-otp` | Verify OTP and return a JWT |
| `GET` | `/loans` | List the authenticated user's loans |
| `POST` | `/loans` | Create a loan |
| `PATCH` | `/loans/:id/repay` | Mark a loan as repaid |
| `GET` | `/loans/summary` | Get lending and overdue totals |

Loan endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

## Security Notes

- Environment files and secrets should never be committed.
- OTP codes are logged to the backend terminal for demonstration only.
- Keep the database URL and JWT secret private.
- Production deployment requires HTTPS and production-grade OTP delivery and abuse protection.

## Future Improvements

- Receipt attachment uploads
- Automated backend tests
- Push notifications for upcoming due dates
- Improved filtering and search
- Production OTP integration

## Author

**Akash Singh**

GitHub: [@akashsingh277](https://github.com/akashsingh277)
