# ToDo API

A robust Express.js backend API for the ToDo application, featuring authentication, real-time messaging, AI-powered todo generation, and PostgreSQL database integration.

## Features

- **Authentication**
  - JWT-based authentication
  - Secure password handling
  - User registration and login

- **Todo Management**
  - CRUD operations for todos
  - Todo sharing between users
  - Due date tracking
  - Smart AI todo generation
  - Search functionality

- **Real-time Messaging**
  - Socket.io integration for real-time chat
  - Private messaging between users
  - Message history

- **AI Integration**
  - Hugging Face API for AI features
  - Smart todo generation from goals
  - Special single todo generation
  - Daily usage limits for AI features

- **User Management**
  - User profile management
  - Daily limits tracking (smart todos, images)
  - AI conversation history

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (jsonwebtoken)
- **Real-time**: Socket.io
- **AI**: Hugging Face Inference API
- **Other**: Cookie-parser, CORS, dotenv

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Hugging Face API token (for AI features)

## Getting Started

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment variables**

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/todo_db"
JWT_SECRET="your_jwt_secret_key"
HF_TOKEN="your_huggingface_api_token"
PORT=5000
```

3. **Set up the database**

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev
```

Or generate the Prisma client:

```bash
npx prisma generate
```

4. **Run the development server**

```bash
npm run dev
```

The server will start on `http://localhost:5000`.

## Available Scripts

- `npm run dev` - Start development server with nodemon and tsx

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user and receive JWT token

### Todos

- `GET /api/todo` - Get all todos for authenticated user
- `POST /api/todo` - Create a new todo
- `PUT /api/todo/:id` - Update a todo
- `DELETE /api/todo/:id` - Delete a todo
- `PATCH /api/todo/:id/complete` - Mark todo as completed
- `POST /api/todo/:id/share` - Share todo with another user
- `DELETE /api/todo/:id/unshare` - Unshare todo from a user
- `GET /api/todo/shared` - Get todos shared with the user
- `POST /api/todo/generate` - Generate smart todo list from goal (AI)
- `POST /api/todo/generate-special` - Generate a special todo (AI)
- `GET /api/search/todos` - Search user's todos
- `GET /api/search/users` - Search other users

### Messages

- `GET /api/message` - Get all conversations
- `GET /api/message/:userId` - Get messages with a specific user
- `POST /api/message` - Send a message

### Users

- `GET /api/user` - Get user profile
- `PUT /api/user` - Update user profile
- `GET /api/users` - Get all users (excluding current user)

## Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **User**: User accounts with authentication and limits
- **Todo**: Todo items with sharing and AI flags
- **Message**: Chat messages between users
- **SharedTodo**: Many-to-many relationship for todo sharing
- **AIConversation**: AI chat history

## Middleware

- **Authentication**: JWT verification for protected routes
- **Smart Todo Counter**: Tracks daily AI todo generation limits
- **CORS**: Cross-origin resource sharing configuration

## Real-time Events

Socket.io events for real-time messaging:

- `sendMessage`: Send a message to a user
- `receiveMessage`: Receive a message from a user
- `joinRoom`: Join a private chat room
- `leaveRoom`: Leave a chat room

## AI Features

### Smart Todo Generation
Uses Hugging Face API to generate a list of actionable todos from a user's goal. Limited to 5 generations per day per user.

### Special Todo Generation
Generates a single, detailed todo from a goal using AI. Also limited to 5 generations per day.

### AI Chat Assistant
Provides conversational AI assistance for todo-related queries.

## Project Structure

```
server-1/
├── middleware/           # Custom middleware
│   ├── countSmartTodo.js # AI usage tracking
│   └── middleware.js     # Authentication middleware
├── prisma/              # Database schema and migrations
│   ├── migrations/      # SQL migration files
│   └── schema.prisma    # Prisma schema definition
├── routes/              # API route handlers
│   ├── TodoRoutes.js    # Todo endpoints
│   ├── messageRoute.js  # Message endpoints
│   └── userRoute.js     # User endpoints
├── client.js            # Socket.io client configuration
├── server.js            # Express server setup
└── package.json         # Dependencies and scripts
```

## Security

- JWT tokens for authentication
- Password hashing (should be implemented with bcrypt)
- CORS configuration
- Environment variable management
- SQL injection prevention via Prisma ORM

## Deployment

To deploy this API:

1. Set up a PostgreSQL database (e.g., on Railway, Supabase, or AWS RDS)
2. Configure environment variables in your hosting platform
3. Build and run the application

Example deployment platforms:
- Railway
- Render
- Heroku
- DigitalOcean App Platform

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Links

- **Client Application**: [ToDo-App](https://github.com/Mamesha3/ToDo-App)
- **Prisma Documentation**: [https://www.prisma.io/docs](https://www.prisma.io/docs)
- **Express Documentation**: [https://expressjs.com/](https://expressjs.com/)
