import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// ── Security headers (must come BEFORE routes) ──────────────────────────────
// Helmet sets sensible defaults for X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, Referrer-Policy, etc. We disable the default
// crossOriginResourcePolicy because the frontend lives on a different origin
// during local development (localhost:3000 vs localhost:5000).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // API only, no HTML served from here
  })
);

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/server-to-server tools without an Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Root Route ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",  authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/services", serviceRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
// In production, never leak internal error details for unhandled 5xx errors.
// Application-thrown errors that carry a 4xx status are user-facing and safe
// to surface verbatim (e.g. validation failures).
app.use((err, _req, res, _next) => {
  console.error("Unhandled Error:", err.stack || err);
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;
  const safeToShow = !isProduction || isClientError;
  res.status(status).json({
    success: false,
    message: safeToShow
      ? err.message || "Internal Server Error"
      : "Internal Server Error",
  });
});

export default app;
