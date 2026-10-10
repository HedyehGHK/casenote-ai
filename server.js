require('dotenv').config();
const mongoose = require('mongoose');

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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});