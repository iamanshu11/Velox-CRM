import { query } from "../../config/db.js";

/**
 * User Model
 * All direct PostgreSQL queries for the `users` table live here.
 * Services call these functions — never write raw SQL in controllers.
 */

const User = {

  /** Find a user by email. Pass { includePassword: true } when you need the hash. */
  findByEmail: async (email, { includePassword = false } = {}) => {
    const fields = includePassword
      ? "id, name, email, password, role, is_active, created_by, created_at"
      : "id, name, email, role, is_active, created_by, created_at";

    const { rows } = await query(
      `SELECT ${fields} FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  /** Find a user by primary key. */
  findById: async (id) => {
    const { rows } = await query(
      `SELECT id, name, email, role, is_active, created_by, created_at
         FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Create a new user row. Returns the created user (no password). */
  create: async ({ name, email, password, role = "employee", createdBy = null }) => {
    const { rows } = await query(
      `INSERT INTO users (name, email, password, role, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, password, role, createdBy]
    );
    return rows[0];
  },

  /** Return all employees (role = 'employee'), newest first. */
  findAllEmployees: async () => {
    const { rows } = await query(
      `SELECT id, name, email, role, is_active, created_at
         FROM users
        WHERE role = 'employee'
        ORDER BY created_at DESC`
    );
    return rows;
  },

  /** Toggle is_active for a user. Returns updated row. */
  toggleActive: async (id) => {
    const { rows } = await query(
      `UPDATE users
          SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1
        RETURNING id, is_active`,
      [id]
    );
    return rows[0] || null;
  },
};

export default User;
