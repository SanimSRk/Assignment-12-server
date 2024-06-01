const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get('/', async (req, res) => {
  res.send('mico work server site is runing ');
});
app.listen(port, () => {
  console.log(`assignment-12 server port is ${port}`);
});
