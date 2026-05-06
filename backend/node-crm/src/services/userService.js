import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * Creates a new employee. Called by Super Admin only (enforced at route level).
 */
export const createEmployee = async ({ name, email, password }, createdById) => {
  const existing = await User.findByEmail(email);
  if (existing) {
    throw { status: 409, message: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const employee = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "employee",
    createdBy: createdById,
  });

  return employee;
};

/**
 * Returns all employee accounts, newest first.
 */
export const getAllEmployees = async () => {
  return User.findAllEmployees();
};

/**
 * Toggles a user's active/inactive status.
 */
export const toggleUserStatus = async (userId) => {
  const result = await User.toggleActive(userId);
  if (!result) throw { status: 404, message: "User not found" };
  return result;
};
