# BrainWave AI

Full-stack AI chat application with Clerk authentication, Gemini responses, image upload support, and persistent chat history.

# Live : https://brain-wave-ai-dev.vercel.app/

## Stack

- Frontend: React 19 + Vite + React Router + TanStack Query
- Backend: Node.js + Express + Mongoose
- Auth: Clerk
- AI: Google Gemini
- Image Upload: ImageKit

## Project Structure

```
BrainWave-AI/
	backend/
	client/
```

## Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas connection string
- Clerk keys
- Gemini API key
- ImageKit keys

## Environment Variables

### Backend (backend/.env)

```
PORT=3000
CLIENT_URL=http://localhost:5173

MONGO=<your_mongodb_uri>

CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>
CLERK_SECRET_KEY=<your_clerk_secret_key>

GEMINI_API_KEY=<your_gemini_api_key>
GEMINI_MODEL=gemini-3.1-flash-lite-preview
GEMINI_MODELS=gemini-3.1-flash-lite-preview,gemini-2.5-flash-lite,gemini-2.5-flash
ALLOW_QUOTA_FALLBACK=true

IMAGE_KIT_ENDPOINT=<your_imagekit_endpoint>
IMAGE_KIT_PUBLIC_KEY=<your_imagekit_public_key>
IMAGE_KIT_PRIVATE_KEY=<your_imagekit_private_key>
```

### Frontend (client/.env)

```
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>
VITE_IMAGE_KIT_ENDPOINT=<your_imagekit_endpoint>
VITE_IMAGE_KIT_PUBLIC_KEY=<your_imagekit_public_key>
```

## Install

```
cd backend
npm install

cd ../client
npm install
```

## Run Locally

Start backend:

```
cd backend
npm run start
```

Start frontend in a new terminal:

```
cd client
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

## Build Frontend

```
cd client
npm run build
```

## Recent Fixes Included

- Stable authenticated API flow for local development
- New chat creation now resolves and navigates reliably
- First prompt in a new chat gets an automatic first AI response
- Duplicate first-user-message issue fixed
- Correct alignment: user right, model left
- Sticky top chat banner replaces distorted title pill
- Safer chat ID validation and fallback handling

## Notes

- Clerk development-key warning in console is expected in local development.
- If ports are occupied, stop existing processes and restart both servers.
