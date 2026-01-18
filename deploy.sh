#!/bin/bash

# AntrianAR Docker Deployment Script
# Usage: ./deploy.sh [command]

set -e

COMPOSE_FILE="docker-compose.yml"

case "${1:-help}" in
    "build")
        echo "🔨 Building Docker images..."
        docker-compose -f $COMPOSE_FILE build
        ;;
    "up")
        echo "🚀 Starting services..."
        docker-compose -f $COMPOSE_FILE up -d
        ;;
    "down")
        echo "🛑 Stopping services..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    "restart")
        echo "🔄 Restarting services..."
        docker-compose -f $COMPOSE_FILE restart
        ;;
    "logs")
        echo "📋 Showing logs..."
        docker-compose -f $COMPOSE_FILE logs -f
        ;;
    "migrate")
        echo "🗄️ Running database migrations..."
        docker-compose -f $COMPOSE_FILE exec app npx prisma migrate deploy
        ;;
    "seed")
        echo "🌱 Seeding database..."
        docker-compose -f $COMPOSE_FILE exec app npx prisma db seed
        ;;
    "studio")
        echo "🎨 Opening Prisma Studio..."
        docker-compose -f $COMPOSE_FILE exec app npx prisma studio
        ;;
    "shell")
        echo "🐚 Opening application shell..."
        docker-compose -f $COMPOSE_FILE exec app sh
        ;;
    "clean")
        echo "🧹 Cleaning up..."
        docker-compose -f $COMPOSE_FILE down -v --rmi all
        docker system prune -f
        ;;
    "full-deploy")
        echo "🚀 Full deployment process..."
        echo "Step 1: Building images..."
        docker-compose -f $COMPOSE_FILE build

        echo "Step 2: Starting services..."
        docker-compose -f $COMPOSE_FILE up -d

        echo "Step 3: Waiting for database..."
        sleep 10

        echo "Step 4: Running migrations..."
        docker-compose -f $COMPOSE_FILE exec app npx prisma migrate deploy

        echo "Step 5: Seeding database..."
        docker-compose -f $COMPOSE_FILE exec app npx prisma db seed

        echo "✅ Deployment complete!"
        echo "🌐 Application available at: http://localhost:3000"
        ;;
    "status")
        echo "📊 Service status:"
        docker-compose -f $COMPOSE_FILE ps
        ;;
    "help"|*)
        echo "AntrianAR Docker Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build        Build Docker images"
        echo "  up           Start all services"
        echo "  down         Stop all services"
        echo "  restart      Restart all services"
        echo "  logs         Show service logs"
        echo "  migrate      Run database migrations"
        echo "  seed         Seed the database"
        echo "  studio       Open Prisma Studio"
        echo "  shell        Open application shell"
        echo "  clean        Clean up containers and images"
        echo "  full-deploy  Complete deployment (build + up + migrate + seed)"
        echo "  status       Show service status"
        echo "  help         Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 full-deploy    # Complete deployment"
        echo "  $0 logs           # View logs"
        echo "  $0 shell          # Access app container"
        ;;
esac