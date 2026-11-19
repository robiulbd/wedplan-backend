# WedPlan — Wedding Planning Platform (Server)

## Project Name and Description

**WedPlan** is the Express.js + MongoDB backend of the Wedding Planning Platform.
It exposes JWT-authenticated API routes for authentication, services, booking
requests and (upcoming) payments, and owns the role / subscription data used by
the client dashboards.

## Important Features

- Better Auth bridge: `POST /api/auth/jwt` mints a JWT for an existing user,
  `GET /api/auth/me` returns the authoritative profile.
- Public service browsing with search, filters, sorting.
- Vendor service management with free-plan limit (max 3 active services).
- Booking request workflow (create, accept, reject, cancel).
- Admin service review (approve / reject / status changes).

## Technology Stack

- Express.js
- MongoDB (Mongoose)
- JWT (jsonwebtoken)
- Stripe
- ImgBB

## Installation Instructions

1. Clone the server repository.
2. Copy `.env` and fill in all required environment variables.

## How to Run the Project Locally

```bash
npm install
npm run dev
```

The API runs on [http://localhost:5000](http://localhost:5000).

## Live Website Link

To be connected once deployed.

## Client and Server Repository Links

- Client: [wedplan-frontend](https://github.com/your-org/wedplan-frontend)
- Server: [wedplan-backend](https://github.com/your-org/wedplan-backend)

## Environment Variables

- MongoDB Connection String
- Better Auth Secret and Configuration
- Google OAuth Credentials
- Stripe Secret Key and Webhook Secret
- ImgBB API Key
- Required Application URLs

## Deployment Guideline

- Keep all sensitive information in environment variables.
- Never push `.env` files or secret credentials to GitHub.

## Evaluation Notes

- Admin credentials provided for evaluation should work on the live site.
- JWT verification and role-based middleware on protected routes.
