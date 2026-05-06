import { loginUser } from "../services/authService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    const result = await loginUser(email, password);
    return sendSuccess(res, result, "Login successful");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * GET /api/auth/me  — returns the currently authenticated user
 */
export const getMe = async (req, res) => {
  try {
    return sendSuccess(res, req.user, "Authenticated user fetched");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
