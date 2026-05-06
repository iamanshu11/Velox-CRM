import { Router } from "express";
import {
  handleCreateEmployee,
  handleGetEmployees,
  handleToggleStatus,
} from "../controllers/userController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = Router();

// All routes below require a valid JWT
router.use(authenticate);

router.post("/employees",            authorizeRoles("super_admin"), handleCreateEmployee);
router.get("/employees",             authorizeRoles("super_admin"), handleGetEmployees);
router.patch("/:id/toggle-status",   authorizeRoles("super_admin"), handleToggleStatus);

export default router;
