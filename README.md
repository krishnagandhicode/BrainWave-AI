# BrainWave AI

BrainWave AI is a production-deployed full-stack AI chat app focused on reliable conversations, persistent history, and a polished UX.

## Live Project

- App: https://brain-wave-ai-dev.vercel.app
- API: https://brainwave-ai-hzw4.onrender.com

## What This Project Demonstrates

- End-to-end AI chat product architecture (frontend + backend + database)
- Secure authentication with protected API routes
- Persistent chat history with real-time conversational flow
- Practical production deployment and environment management

## Core Features

- Authentication with Clerk
- Create and manage multiple chat sessions
- AI responses powered by Gemini (with fallback behavior)
- Image upload support with ImageKit
- Chat persistence in MongoDB Atlas
- Improved message UX: user on right, AI on left, clean chat header banner

## Tech Stack

- Frontend: React 19, Vite, React Router, TanStack Query
- Backend: Node.js, Express, Mongoose
- Auth: Clerk
- AI: Google Gemini
- Media: ImageKit
- Deployment: Vercel (frontend), Render (backend)

## Engineering Highlights

- Hardened auth flow for API routes and client token usage
- Fixed edge cases around new chat creation and invalid IDs
- Stabilized first-message behavior so initial prompts are handled correctly
- Added safer API URL/error handling across the client
- Added production SPA routing support on Vercel for auth callback paths
- Improved deployment safety by using production start commands and env-based config

## Project Structure

```
BrainWave-AI/
  backend/
  client/
```

## Status

- Deployed and working in production
- Ready to be showcased in a portfolio/case study

## Next Improvements

- Move Clerk from test keys to production keys
- Rotate exposed secrets periodically and enforce stricter secret hygiene
- Add chunk splitting/performance optimization for frontend bundle size
