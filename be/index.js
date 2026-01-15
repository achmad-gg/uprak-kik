require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log('Attendance system running on port', PORT);
});
