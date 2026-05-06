import bcrypt from "bcrypt";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

/**
 * Validates credentials and returns a JWT + user info.
 */
export const loginUser = async (email, password) => {
  const user = await User.findByEmail(email, { includePassword: true });

  if (!user) {
    throw { status: 404, message: "No account found with that email" };
  }

  if (!user.is_active) {
    throw { status: 403, message: "Your account has been deactivated" };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw { status: 401, message: "Invalid credentials" };
  }

  const token = generateToken({ id: user.id, role: user.role });

  return {
    token,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};
