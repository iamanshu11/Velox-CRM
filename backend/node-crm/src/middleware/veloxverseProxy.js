import axios from "axios";
import { AUTH_COOKIE_NAME } from "../controllers/authController.js";

const VV_BASE = process.env.VELOXVERSE_API_URL || "http://localhost:5005/api/v1";

/**
 * Forward any request from /api/vv-admin/* to the VeloxVerse backend.
 *
 * The path is forwarded as-is (minus the /api/vv-admin prefix, which is
 * stripped by Express when this is mounted at /api/vv-admin).
 *
 * Auth: the CRM JWT (from the httpOnly cookie) is sent as a Bearer token.
 * VeloxVerse's CRM bridge middleware verifies it with the shared CRM_JWT_SECRET.
 */
export default async function veloxverseProxy(req, res) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Build the target URL: req.url is everything after the mount point
  // e.g. if mounted at /api/vv-admin, and the request is /api/vv-admin/admin/analytics/overview
  // then req.url = /admin/analytics/overview
  const targetUrl = `${VV_BASE}${req.url}`;

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CRM-User-Email": req.user?.email || "",
      },
      data: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? req.body : undefined,
      params: req.method === "GET" ? req.query : undefined,
      // Don't let axios parse the response — we stream it as-is
      validateStatus: () => true,
      // Timeout: 30s for long analytics queries
      timeout: 30000,
    });

    // Forward the VeloxVerse response status + body to the CRM frontend
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("[VV-Proxy] Error forwarding to VeloxVerse:", err.message);
    if (err.code === "ECONNREFUSED") {
      return res.status(502).json({
        success: false,
        message: "VeloxVerse service is not available. Please try again later.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to connect to VeloxVerse service.",
    });
  }
}
