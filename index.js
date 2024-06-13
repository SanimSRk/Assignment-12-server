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
    const withdrawCollection = MicroTask.collection('withdraw_request');
    const testimonialCollection = MicroTask.collection('testimonial');
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      });

      res.send({ token });
    });

    //verfiy token-------------
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden acces' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
          return res.status(401).send({ message: 'forbidden access' });
        }

        req.decode = decode;

        next();
      });
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req?.decode?.email;
      const qurey = { email: email, role: 'isAdmin' };
      const isAdmin = await userCollcation.findOne(qurey);

      if (!isAdmin) {
        return res.status(401).send({ message: 'forbidden access' });
      }

      next();
    };
    const verifyWorkers = async (req, res, next) => {
      const email = req?.decode?.email;
      const qurey = { email: email, role: 'worker' };
      const isWorkers = await userCollcation.findOne(qurey);

      if (!isWorkers) {
        return res.status(401).send({ message: 'forbidden access' });
      }

      next();
    };
    const verifyTaskCreator = async (req, res, next) => {
      const email = req?.decode?.email;
      const qurey = { email: email, role: 'taskCreator' };
      const isTaskCreator = await userCollcation.findOne(qurey);
      console.log(isTaskCreator);
      if (!isTaskCreator) {
        return res.status(401).send({ message: 'forbidden access' });
      }
      next();
    };

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

    app.get('/users', verifyToken, async (req, res) => {
      const email = req.query.email;
      const qurey = { email: email };
      const result = await userCollcation.findOne(qurey);
      res.send(result);
    });

    //tasks creator section
    app.post('/alltasks', verifyToken, verifyTaskCreator, async (req, res) => {
      const task = req.body;
      const email = { email: task?.creator_email };

      const user = await userCollcation.findOne(email);
      const totalCoins = user?.coin;
      const quantity = task?.task_quantity * task?.payable_amount;

      if (totalCoins < quantity) {
        return res.send({ message: 'notAvailable' });
      } else {
        const result = await tasksCollcation.insertOne(task);
        if (result.insertedId) {
          const decrease = await userCollcation.updateOne(email, {
            $inc: { coin: -quantity },
          });
        }

        res.send(result);
      }
    });

    app.get('/my-tasks', verifyToken, verifyTaskCreator, async (req, res) => {
      const email = req.query.creator_email;
      const qurey = { creator_email: email };
      const result = await tasksCollcation
        .find(qurey)
        .sort({ completion_date: -1 })
        .toArray();
      res.send(result);
    });

    app.get('/feature', async (req, res) => {
      const result = await featureCollcation.find().toArray();

      res.send(result);
    });

    app.get('/buyCart', verifyToken, verifyTaskCreator, async (req, res) => {
      const result = await buyCartCollection.find().toArray();
      res.send(result);
    });
    app.get('/buy-cartId/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await buyCartCollection.findOne(qurey);
      res.send(result);
    });
    app.delete(
      '/tasks-delete/:id',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const result = await tasksCollcation.deleteOne(qurey);
        res.send(result);
      }
    );

    app.get('/updateTasks/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.findOne(qurey);
      res.send(result);
    });

    app.put(
      '/tasks-updates/:id',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
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
      }
    );
    //create-payment-intent
    app.post(
      '/create-payment-intent',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
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
      }
    );

    app.post('/payments', verifyToken, verifyTaskCreator, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.patch('/increase', verifyToken, verifyTaskCreator, async (req, res) => {
      const email = req.query.email;
      const qurey = { email: email };
      const coin = req.body.coin;
      const updateDec = {
        $inc: { coin: +coin },
      };
      const result = await userCollcation.updateOne(qurey, updateDec);
      res.send(result);
    });

    app.get(
      '/payment-history',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const email = req.query.email;
        const query = { email: email };
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get(
      '/submit-reviews',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const email = req.query.creator_email;
        const qureys = { creator_email: email, status: 'pending' };
        const result = await submitCollcation.find(qureys).toArray();
        res.send(result);
      }
    );

    app.patch(
      '/status-approve/:id',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const updateDec = {
          $set: {
            status: 'approve',
          },
        };

        const result = await submitCollcation.updateOne(qurey, updateDec);
        res.send(result);
      }
    );

    app.patch(
      '/increase-userCoin',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const email = req.query.worker_email;
        const amounts = parseFloat(req.body.amount);
        const qurey = { email: email };
        const updateDec = {
          $inc: { coin: +amounts },
        };

        const result = await userCollcation.updateOne(qurey, updateDec);
        res.send(result);
      }
    );

    app.patch(
      '/reject-userTasks/:id',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const updateDec = {
          $set: { status: 'reject' },
        };
        const result = await submitCollcation.updateOne(qurey, updateDec);
        res.send(result);
      }
    );

    app.get('/top-six', async (req, res) => {
      const role = { role: 'worker' };
      const result = await userCollcation
        .find(role)
        .sort({ coin: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    app.get('/tasks-counts', async (req, res) => {
      const email = req.query.email;
      const qurey = {
        worker_email: email,
        status: 'approve',
      };

      const counts = await submitCollcation.find(qurey).toArray();
      res.send(counts);
    });

    app.get('/testimonials-users', async (req, res) => {
      const result = await testimonialCollection.find().toArray();
      res.send(result);
    });

    app.get(
      '/approve-tasksAll',
      verifyToken,
      verifyTaskCreator,
      async (req, res) => {
        const email = req.query.email;
        const qureys = { creator_email: email, status: 'approve' };
        const payment = await submitCollcation.find(qureys).toArray();
        const result = payment.reduce(
          (workers, items) => workers + parseFloat(items.payable_amount),
          0
        );

        res.send({ result });
      }
    );

    //----------- worker data api section ----------------
    app.get('/tasks-list', verifyToken, verifyWorkers, async (req, res) => {
      const result = await tasksCollcation
        .find({ task_quantity: { $gt: 0 } })
        .toArray();
      res.send(result);
    });

    app.get('/tasksDeatils/:id', async (req, res) => {
      const id = req.params.id;
      const qurey = { _id: new ObjectId(id) };
      const result = await tasksCollcation.findOne(qurey);
      res.send(result);
    });

    app.post('/tasks-submit', verifyToken, verifyWorkers, async (req, res) => {
      const submit = req.body;
      const result = await submitCollcation.insertOne(submit);
      res.send(result);
    });

    app.get('/my-submission', verifyToken, verifyWorkers, async (req, res) => {
      const email = req.query?.worker_email;
      const pages = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log(pages, size);
      const qurey = { worker_email: email };
      const result = await submitCollcation
        .find(qurey)
        .skip(pages * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get(
      '/worker-allSubmicon',
      verifyToken,
      verifyWorkers,
      async (req, res) => {
        const email = req.query.worker_email;
        const qurey = { worker_email: email };
        const workerSubmit = await submitCollcation.find(qurey).toArray();
        res.send(workerSubmit);
      }
    );

    app.get(
      '/workers-amounts',
      verifyToken,
      verifyWorkers,
      async (req, res) => {
        const email = req.query.worker_email;
        const qureyAmounts = { worker_email: email, status: 'approve' };
        const amounts = await submitCollcation.find(qureyAmounts).toArray();
        res.send(amounts);
      }
    );

    app.patch(
      '/drcress-quantity/:id',
      verifyToken,
      verifyWorkers,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const updateDec = {
          $inc: {
            task_quantity: -1,
          },
        };
        const result = await tasksCollcation.updateOne(qurey, updateDec);
        res.send(result);
      }
    );

    app.post(
      '/withdraw-requests',
      verifyToken,
      verifyWorkers,
      async (req, res) => {
        const request = req.body;
        const result = await withdrawCollection.insertOne(request);
        res.send(result);
      }
    );

    app.patch(
      '/withdrawUser-decrease',
      verifyToken,
      verifyWorkers,
      async (req, res) => {
        const email = req.query.email;
        const qurey = { email: email };
        const coins = req.body.withdraw_coin;
        const updateDec = {
          $inc: {
            coin: -coins,
          },
        };
        const result = await userCollcation.updateOne(qurey, updateDec);
        res.send(result);
      }
    );

    app.get('/submentCount', verifyToken, verifyWorkers, async (req, res) => {
      const email = req.query.email;
      const qurey = { worker_email: email };
      const result = await submitCollcation.find(qurey).toArray();
      res.send(result);
    });

    //------admim section crate api------------------
    app.get('/worker-users', verifyToken, verifyAdmin, async (req, res) => {
      const role = { role: 'worker' };
      const result = await userCollcation.find(role).toArray();

      res.send(result);
    });
    app.patch('/user-role/:id', verifyToken, verifyAdmin, async (req, res) => {
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

    app.delete(
      '/delete-user/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const result = await userCollcation.deleteOne(qurey);
        res.send(result);
      }
    );

    app.get('/tasks-manages', verifyToken, verifyAdmin, async (req, res) => {
      const result = await tasksCollcation.find().toArray();
      res.send(result);
    });
    app.delete(
      '/task-deletes/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const result = await tasksCollcation.deleteOne(qurey);
        res.send(result);
      }
    );

    app.get('/admin-status', verifyToken, verifyAdmin, async (req, res) => {
      const tottalUers = await userCollcation.estimatedDocumentCount();
      const totalCoins = await userCollcation.find().toArray();
      const totals = totalCoins.reduce((total, item) => total + item?.coin, 0);

      const qurey = { status: 'approve' };
      const totalPayments = await submitCollcation.find(qurey).toArray();
      const payments = totalPayments.reduce(
        (pay, items) => pay + parseFloat(items?.payable_amount),
        0
      );
      res.send({ tottalUers, totals, payments });
    });

    app.get('/success-payments', verifyToken, verifyAdmin, async (req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    });

    app.delete(
      '/withdraw-deletes/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const qurey = { _id: new ObjectId(id) };
        const withdraw = await withdrawCollection.deleteOne(qurey);
        res.send(withdraw);
      }
    );

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
