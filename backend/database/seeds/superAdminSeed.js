/**
 *
 *   node database/seeds/superAdminSeed.js
 *
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "crm_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
});

const SUPER_ADMIN = {
  name:     "Super Admin",
  email:    "admin@crm.com",
  password: "Admin@1234", 
  role:     "super_admin",
};

const seed = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [SUPER_ADMIN.email]
    );

    if (rows.length > 0) {
      console.log("ℹ️  Super Admin already exists — skipping seed");
      return;
    }

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10);

    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      [SUPER_ADMIN.name, SUPER_ADMIN.email, hashedPassword, SUPER_ADMIN.role]
    );

    console.log("🎉 Super Admin seeded successfully!");
    console.log(`   Email   : ${SUPER_ADMIN.email}`);
    console.log(`   Password: ${SUPER_ADMIN.password}`);
    console.log("   ⚠️  Change the password after first login!\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
