# Docker Deployment Guide

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. **Clone the repository and navigate to the project directory**
   ```bash
   cd antrianar
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Update environment variables in `.env` if needed**
   - Database credentials
   - JWT secret key
   - NextAuth URL

4. **Build and run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

5. **Run database migrations**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

6. **Seed the database (optional)**
   ```bash
   docker-compose exec app npx prisma db seed
   ```

## Access the Application

- **Application**: http://localhost:3000
- **Database**: localhost:5505 (PostgreSQL)

## Docker Commands

### Development
```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate
```

### Database Management
```bash
# Access database shell
docker-compose exec db psql -U admin -d antrianar_db

# Run Prisma commands
docker-compose exec app npx prisma studio
docker-compose exec app npx prisma migrate dev
docker-compose exec app npx prisma db push
```

### Production Deployment
```bash
# Build for production
docker-compose -f docker-compose.yml up --build -d

# Scale the application
docker-compose up -d --scale app=3
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://admin:admin@db:5432/antrianar_db` |
| `SECRET_KEY` | JWT secret key | `super_secret_key_at_least_32_characters_long_for_sessions` |
| `NEXTAUTH_URL` | NextAuth callback URL | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### Application Issues
```bash
# View application logs
docker-compose logs app

# Restart application
docker-compose restart app

# Access application container
docker-compose exec app sh
```

### Clean Restart
```bash
# Stop and remove all containers, networks
docker-compose down

# Remove volumes (WARNING: This will delete database data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```