require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const clientsRouter = require('./routes/clients');

app.use(cors());
app.use(express.json());

app.use('/clients', clientsRouter);

app.get('/', (req, res) => {
  res.send('CaseNote AI Server is running');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});