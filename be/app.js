const express = require('express');
const morgan = require('morgan');
const rateLimit = require('./middleware/rateLimitMiddleware');

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(rateLimit);

app.use('/api/auth', require('./modules/auth/authRoutes'));
app.use('/api/attendance', require('./modules/attendance/attendanceRoutes'));
app.use('/api/audit', require('./modules/audit/auditRoutes'));
app.use('/api/export', require('./modules/export/exportRoutes'));

module.exports = app;
