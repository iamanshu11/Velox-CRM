import { createEmployee, getAllEmployees, toggleUserStatus } from "../services/userService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * POST /api/users/employees
 * Super Admin only — create a new employee account
 */
export const handleCreateEmployee = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendError(res, "Name, email and password are required", 400);
    }

    const employee = await createEmployee({ name, email, password }, req.user.id);
    return sendSuccess(res, employee, "Employee created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * GET /api/users/employees
 * Super Admin only — list all employees
 */
export const handleGetEmployees = async (_req, res) => {
  try {
    const employees = await getAllEmployees();
    return sendSuccess(res, employees, "Employees fetched successfully");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * PATCH /api/users/:id/toggle-status
 * Super Admin only — activate or deactivate a user
 */
export const handleToggleStatus = async (req, res) => {
  try {
    const result = await toggleUserStatus(req.params.id);
    return sendSuccess(res, result, "User status updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
