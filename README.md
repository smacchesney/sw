# Storywink.ai

Storywink.ai enables busy parents to transform their cherished photos and memories into personalized, AI-generated children's picture books.

## Features

- **User Authentication**: Secure authentication system with email/password and social logins
- **Digital Library**: Manage your book projects in a personalized library
- **Book Creation Workflow**:
  - Step 1: Upload photos and create a storyboard
  - Step 2: Review and edit AI-generated story text
  - Step 3: Generate illustrations and preview the final book
- **AI Integration**: GPT-4o Vision for story generation and DALL-E 3 for illustrations
- **PDF Export**: Download your completed books as PDF files

## Getting Started

### Prerequisites

- Node.js 18.0.0 or newer
- npm or yarn
- PostgreSQL database
- Cloudinary account
- OpenAI API key
- Clerk account (for authentication)

### Installation

1. Clone the repository:

   ```bash
   git clone [repository-url]
   cd storywink-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Then edit the `.env` file with your actual API keys and configuration.

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

- `src/app`: Main application routes and layouts (Next.js App Router)
  - `api/`: API route handlers
- `src/components`: Reusable UI components, organized by feature or type
  - `ui/`: Primitive UI components built with shadcn/ui
- `src/lib`: Utilities, helpers, and configuration files
- `src/hooks`: Custom React hooks
- `src/types`: TypeScript type definitions and interfaces
- `src/styles`: Global styles and CSS modules
- `public/`: Static assets
  - `images/`: Application images

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk.dev
- **Image Storage**: Cloudinary
- **AI**: OpenAI (GPT-4o Vision, DALL-E 3)
- **Deployment**: Vercel
