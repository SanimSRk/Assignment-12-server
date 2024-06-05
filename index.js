const express = require('express');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mqe77mp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const MicroTask = client.db('MicroTaskDB');
    const userCollcation = MicroTask.collection('MicroUsers');
    const featureCollcation = MicroTask.collection('feature');
    const tasksCollcation = MicroTask.collection('Tasks');
    const submitCollcation = MicroTask.collection('Tasks_submit');

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      });

      res.send({ token });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const qurey = { email: user?.email };

      const isExisting = await userCollcation.findOne(qurey);
      if (!isExisting) {
        const result = await userCollcation.insertOne(user);
        res.send(result);
      } else {
        return res.send({ message: 'user alredy esist' });
      }
    });

    app.get('/users', async (req, res) => {
      const email = req.query.email;
      const qurey = { email: email };
      const result = await userCollcation.findOne(qurey);
      res.send(result);
    });
    //tasks creator section
    app.post('/alltasks', async (req, res) => {
      const task = req.body;
      const result = await tasksCollcation.insertOne(task);
      res.send(result);
    });

    app.get('/my-tasks', async (req, res) => {
      const email = req.query.creator_email;
      const qurey = { creator_email: email };
      const result = await tasksCollcation.find(qurey).toArray();
      res.send(result);
    });

    app.get('/feature', async (req, res) => {
      const result = await featureCollcation.find().toArray();

      res.send(result);
    });

    app.delete('/tasks-delete/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.deleteOne(qurey);
      res.send(result);
    });

    //----------- worker data api section ----------------
    app.get('/tasks-list', async (req, res) => {
      const result = await tasksCollcation.find().toArray();
      res.send(result);
    });

    app.get('/tasksDeatils/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.findOne(qurey);
      res.send(result);
    });

    app.post('/tasks-submit', async (req, res) => {
      const submit = req.body;
      const result = await submitCollcation.insertOne(submit);
      res.send(result);
    });

    app.get('/my-submission', async (req, res) => {
      const email = req.query?.worker_email;
      const qurey = { worker_email: email };
      const result = await submitCollcation.find(qurey).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });

    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', async (req, res) => {
  res.send('mico work server site is runing ');
});
app.listen(port, () => {
  console.log(`assignment-12 server port is ${port}`);
});
