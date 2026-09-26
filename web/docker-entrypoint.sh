#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Bootstrapping initial admin and settings..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function bootstrap() {
  try {
    // Ensure club settings exist
    await prisma.clubSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        clubName: 'Boggoms Bay Golf Club',
        timezone: 'Africa/Johannesburg',
        bookingWindowDays: 7,
        cancellationLeadHours: 24,
      },
      update: {},
    });

    // Bootstrap initial admin from env vars (only if no admin exists)
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount === 0) {
      const email = process.env.INITIAL_ADMIN_EMAIL;
      const password = process.env.INITIAL_ADMIN_PASSWORD;

      if (email && password) {
        const passwordHash = await bcrypt.hash(password, 12);
        
        // Check if email already exists (for admin/guest uniqueness)
        const existing = await prisma.user.findFirst({
          where: { 
            email: email.toLowerCase().trim(),
            role: { in: ['ADMIN', 'GUEST'] }
          }
        });
        
        if (!existing) {
          await prisma.user.create({
            data: {
              email: email.toLowerCase().trim(),
              name: 'Admin',
              passwordHash,
              role: 'ADMIN',
              status: 'ACTIVE',
              emailVerifiedAt: new Date(),
            },
          });
          console.log('✓ Initial admin created:', email);
        } else {
          console.log('✓ Admin email already exists:', email);
        }
      } else {
        console.warn(
          '⚠ No admin accounts exist. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to create one.'
        );
      }
    } else {
      console.log('✓', adminCount, 'admin account(s) exist');
    }

    console.log('✓ Bootstrap complete');
  } catch (error) {
    console.error('Bootstrap error:', error);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

bootstrap();
"

echo "Starting application..."
exec "$@"
