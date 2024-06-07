const express = require('express');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRECT_KEY);
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
    const buyCartCollection = MicroTask.collection('buyCart');
    const paymentCollection = MicroTask.collection('payments');
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
      const email = { email: task?.creator_email };

      const user = await userCollcation.findOne(email);
      const totalCoins = user?.coin;
      const quantity = task?.task_quantity * task?.payable_amount;

      if (totalCoins < quantity) {
        return res.send({ message: 'notAvailable' });
      } else {
        const decrease = await userCollcation.updateOne(email, {
          $inc: { coin: -quantity },
        });
        const result = await tasksCollcation.insertOne(task);
        res.send(result);
      }
    });

    app.get('/my-tasks', async (req, res) => {
      const email = req.query.creator_email;
      const qurey = { creator_email: email };
      const result = await tasksCollcation
        .find(qurey)
        .sort({ completion_date: 1 })
        .toArray();
      res.send(result);
    });

    app.get('/feature', async (req, res) => {
      const result = await featureCollcation.find().toArray();

      res.send(result);
    });

    app.get('/buyCart', async (req, res) => {
      const result = await buyCartCollection.find().toArray();
      res.send(result);
    });
    app.get('/buy-cartId/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await buyCartCollection.findOne(qurey);
      res.send(result);
    });
    app.delete('/tasks-delete/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.deleteOne(qurey);
      res.send(result);
    });

    app.get('/updateTasks/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.findOne(qurey);
      res.send(result);
    });

    app.put('/tasks-updates/:id', async (req, res) => {
      const id = req.params.id;
      const update = req.body;
      const qurey = { _id: new ObjectId(id) };
      const updateDec = {
        $set: {
          task_title: update?.task_title,
          task_detail: update?.task_detail,
          submission_info: update?.submission_info,
        },
      };

      const result = await tasksCollcation.updateOne(qurey, updateDec);
      res.send(result);
    });
    //create-payment-intent
    app.post('/create-payment-intent', async (req, res) => {
      const price = req.body.price;
      const priceInSent = parseFloat(price) * 100;
      if (!price || priceInSent < 1) {
        return;
      }

      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInSent,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({ clientSecret: client_secret });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.patch('/increase', async (req, res) => {
      const email = req.query.email;
      const qurey = { email: email };
      const coin = req.body.coin;
      const updateDec = {
        $inc: { coin: +coin },
      };
      const result = await userCollcation.updateOne(qurey, updateDec);
      res.send(result);
    });

    app.get('/payment-history', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
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

    app.get('/worker-users', async (req, res) => {
      const role = { role: 'worker' };
      const result = await userCollcation.find(role).toArray();

      res.send(result);
    });

    app.patch('/user-role/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };

      const user = req.body;
      const updateDec = {
        $set: {
          role: user.role,
          coin: user.coin,
        },
      };

      const result = await userCollcation.updateOne(qurey, updateDec);
      res.send(result);
    });

    app.delete('/delete-user/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await userCollcation.deleteOne(qurey);
      res.send(result);
    });

    app.get('/tasks-manages', async (req, res) => {
      const result = await tasksCollcation.find().toArray();
      res.send(result);
    });
    app.delete('/task-deletes/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.deleteOne(qurey);
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
