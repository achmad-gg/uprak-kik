const express = require("express");
const morgan = require("morgan");
const rateLimit = require("./middleware/rateLimitMiddleware");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));
app.use(rateLimit);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use("/api/auth", require("./modules/auth/authRoutes"));
app.use("/api/attendance", require("./modules/attendance/attendanceRoutes"));
app.use("/api/audit", require("./modules/audit/auditRoutes"));
app.use("/api/export", require("./modules/attendance/attendanceExportRoute"));
app.use("/api/admin", require("./modules/admin/adminRoutes"));
app.use("/api/holidays", require("./modules/holidays/holidaysRoutes"));
app.use("/api/leaves", require("./modules/leaves/leavesRoutes"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(
  "/static",
  express.static(path.join(process.cwd(), "uploads"), {
    index: false,
    maxAge: "1d",
  }),
);

module.exports = app;
