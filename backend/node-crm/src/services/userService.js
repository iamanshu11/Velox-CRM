import bcrypt from "bcrypt";
import User from "../models/User.js";
import { validatePassword } from "../utils/passwordPolicy.js";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "agent", "affiliate"];

const ROLE_CREATION_MATRIX = {
  super_admin: ["super_admin", "admin", "employee", "agent", "affiliate"],
  admin: ["employee", "agent", "affiliate"],
  employee: ["agent", "affiliate"],
};

/**
 * Creates a new CRM user account with role hierarchy checks.
 */
export const createUser = async ({ name, email, password, role }, creator) => {
  const targetRole = role?.trim?.();
  if (!targetRole || !ALLOWED_ROLES.includes(targetRole)) {
    throw { status: 400, message: "Invalid role provided" };
  }

  const creatorRole = creator?.role;
  const creatableRoles = ROLE_CREATION_MATRIX[creatorRole] || [];
  if (!creatableRoles.includes(targetRole)) {
    throw {
      status: 403,
      message: `Role '${creatorRole}' is not allowed to create '${targetRole}' users`,
    };
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) {
    throw { status: 400, message: "Email is required" };
  }

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) {
    throw { status: 400, message: pwdCheck.message };
  }

  const existing = await User.findByEmail(normalizedEmail);
  if (existing) {
    throw { status: 409, message: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password.trim(), 10);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: targetRole,
    createdBy: creator.id,
  });

  return user;
};

/**
 * Returns CRM user accounts, newest first, with pagination metadata.
 */
export const getAllUsers = async ({ limit, offset } = {}) => {
  const [items, total] = await Promise.all([
    User.findAllUsers({ limit, offset }),
    User.countAllUsers(),
  ]);
  return { items, total, limit, offset };
};

/**
 * Returns aggregate counts for the user-management dashboard cards.
 * Cheaper and more accurate than paginating + summing client-side.
 */
export const getUserStats = async () => User.getUserStats();

/**
 * Toggles a user's active/inactive status.
 *
 * Refuses to operate when the caller is targeting their own account — a
 * super-admin should not be able to lock themselves out of the system.
 */
export const toggleUserStatus = async (userId, requesterId) => {
  if (requesterId !== undefined && String(userId) === String(requesterId)) {
    throw {
      status: 400,
      message: "You cannot change your own account status",
    };
  }
  const result = await User.toggleActive(userId);
  if (!result) throw { status: 404, message: "User not found" };
  return result;
};
