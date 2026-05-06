import "dotenv/config";
import app from "./src/app.js";
import pool from "./config/db.js";

const PORT = process.env.PORT || 5000;

// Verify DB is reachable, then start the HTTP server
pool.connect()
  .then((client) => {
    client.release();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
      console.log(`   Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  });
