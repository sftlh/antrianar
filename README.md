# AntrianAR - Sistem Antrian Konsultasi Pajak

Sistem manajemen antrian konsultasi pajak berbasis web dengan real-time updates menggunakan Next.js, Prisma, dan PostgreSQL.

## 🚀 Fitur Utama

- **Real-time Updates**: WebSocket integration untuk update antrian secara real-time
- **Role-based Access Control**: Sistem otentikasi dengan berbagai role (AR, Receptionist, Kepala Kantor, dll)
- **Dashboard Interaktif**: Interface modern untuk setiap role pengguna
- **Manajemen Konsultasi**: Sistem lengkap untuk mengelola proses konsultasi
- **Chat System**: Fitur chat terintegrasi antar pengguna
- **Export Data**: Ekspor data konsultasi dalam format Excel

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Authentication**: JWT dengan httpOnly cookies
- **Deployment**: Docker & Docker Compose

## 📋 Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (untuk development lokal)

## 🚀 Quick Start dengan Docker

### Development Setup

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd antrianar
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env sesuai kebutuhan
   ```

3. **Deploy dengan Docker**
   ```bash
   # Full deployment (build + up + migrate + seed)
   ./deploy.sh full-deploy

   # Atau manual step by step:
   docker-compose up --build
   docker-compose exec app npx prisma migrate deploy
   docker-compose exec app npx prisma db seed
   ```

4. **Akses aplikasi**
   - Aplikasi: http://localhost:3000
   - Database: localhost:5505

### Manual Development Setup

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev
```

## 📁 Project Structure

```
antrianar/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   ├── dashboard/      # Dashboard pages by role
│   │   └── ...
│   ├── lib/                # Utility libraries
│   └── middleware.ts       # Authentication middleware
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Database seeding
├── public/                 # Static assets
├── docker/                 # Docker related files
└── ...
```

## 🐳 Docker Deployment

### File Konfigurasi Docker

- `Dockerfile` - Container untuk aplikasi Next.js
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production environment
- `nginx.conf` - Reverse proxy configuration
- `deploy.sh` - Deployment script

### Production Deployment

```bash
# Setup production environment
cp .env.prod .env
# Edit .env dengan konfigurasi production

# Deploy dengan production compose
docker-compose -f docker-compose.prod.yml up --build -d

# Setup SSL (opsional)
# Copy SSL certificates ke ./ssl/
```

### Docker Commands

```bash
# Development
./deploy.sh full-deploy    # Full deployment
./deploy.sh logs          # View logs
./deploy.sh shell         # Access container shell
./deploy.sh studio        # Open Prisma Studio

# Database management
./deploy.sh migrate       # Run migrations
./deploy.sh seed          # Seed database

# Cleanup
./deploy.sh clean         # Remove containers and images
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://admin:admin@db:5432/antrianar_db` |
| `SECRET_KEY` | JWT secret key | Required |
| `NEXTAUTH_URL` | NextAuth callback URL | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `development` |

## 📊 Database Schema

Proyek menggunakan Prisma ORM dengan PostgreSQL. Schema meliputi:

- **Users**: Manajemen pengguna dengan role-based access
- **Taxpayers**: Data wajib pajak
- **Consultations**: Record konsultasi
- **Rooms**: Ruangan konsultasi
- **Seksi**: Departemen/divisi
- **Chat**: Sistem pesan

## 🔐 Authentication

- JWT-based authentication dengan httpOnly cookies
- Role-based access control (RBAC)
- Secure password hashing dengan bcryptjs

## 📈 Monitoring & Health Checks

- Health check endpoint: `/api/health`
- Database connection monitoring
- Container health checks

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

Untuk pertanyaan atau dukungan, silakan buat issue di repository ini.
