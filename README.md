# ChatBot Pro - Enterprise Multi-User SaaS Platform

A modern, full-featured chatbot SaaS platform built with React, TypeScript, and Supabase.

## 🚀 Features

- **Multi-User Authentication** - Secure signup/signin with Supabase Auth
- **Chatbot Management** - Create, configure, and deploy AI chatbots
- **Document Processing** - Upload and manage knowledge base documents
- **Real-time Analytics** - Track conversations, users, and performance
- **Responsive Design** - Beautiful UI that works on all devices
- **Row Level Security** - Secure data isolation between users

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **Build Tool**: Vite

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatbot-saas-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   ```bash
   npm run setup-db
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Setup

### Option 1: Automated Setup (Recommended)
Run the setup script:
```bash
npm run setup-db
```

### Option 2: Manual Setup
If the automated setup doesn't work, you can manually create the database schema:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Execute the SQL to create all tables and policies

### Option 3: Using Supabase CLI (If Available)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push the migration
supabase db push
```

## 📋 Database Schema

The application uses the following main tables:

- **`users`** - User profiles extending Supabase auth
- **`chatbots`** - AI chatbot configurations
- **`documents`** - Knowledge base files
- **`conversations`** - Chat sessions
- **`messages`** - Individual chat messages

All tables have Row Level Security (RLS) enabled to ensure data isolation between users.

## 🔐 Authentication

The app uses Supabase Auth with the following features:

- Email/password authentication
- Automatic user profile creation
- Password reset functionality
- Protected routes
- Session management

## 🎨 UI Components

- **AuthLayout** - Consistent authentication page layout
- **ProtectedRoute** - Route protection wrapper
- **LoadingSpinner** - Loading state component
- **ChatbotPreview** - Real-time chatbot preview
- **CreateChatbotModal** - Chatbot creation wizard

## 📊 Features Overview

### Dashboard
- Overview of all chatbots
- Key metrics and analytics
- Recent activity feed

### Chatbot Management
- Create chatbots with templates
- Configure appearance and behavior
- Real-time preview
- Embed code generation

### Document Management
- Upload knowledge base files
- Process documents for AI training
- Manage document status

### Analytics
- Conversation metrics
- User engagement data
- Geographic distribution
- Performance insights

### Settings
- Chatbot configuration
- Appearance customization
- Behavior settings
- Security options

## 🚀 Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to your preferred platform**
   - Vercel
   - Netlify
   - AWS S3 + CloudFront
   - Any static hosting service

3. **Set environment variables** in your deployment platform

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run setup-db` - Set up database schema

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   └── ...
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── pages/              # Page components
└── ...
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Database Setup Issues
- Ensure your Supabase project is active
- Verify environment variables are correct
- Check Supabase project settings
- Try manual setup if automated setup fails

### Authentication Issues
- Verify Supabase Auth is enabled
- Check email confirmation settings
- Ensure RLS policies are correctly set up

### Build Issues
- Clear node_modules and reinstall dependencies
- Check for TypeScript errors
- Verify all environment variables are set

## 📞 Support

For support, please open an issue on GitHub or contact the development team.