const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const { response } = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRITE);
const fileupload = require('express-fileupload');

const port = process.env.PORT || 5000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
app.use(cors());
app.use(express.json());
app.use(fileupload());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.89jki.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];

      try {
          const decodedUser = await admin.auth().verifyIdToken(token);
          req.decodedEmail = decodedUser.email;
      }
      catch {

      }

  }
  next();
}

async function run() {
    try {
      await client.connect();
      const database = client.db('doctor_portal');
      const appointmentsCollection = database.collection('appointments');
      const usersCollection = database.collection('users'); 
      const doctorCollection = database.collection('doctor'); 
     
      app.get('/appointments', verifyToken, async (req, res) => {
        const email = req.query.email;
        const date = req.query.date;
        const query = { email: email, date: date };
        const cursor = appointmentsCollection.find(query);
        const appointments = await cursor.toArray();
        res.json(appointments);
    });

    app.get('/payment/:id', async(res, req)=>{
const id = req.params.id;
const query = {_id: ObjectId(id)};
const result = await appointmentsCollection.findOne(query);
res.json(result);

    });

    app.post('/appointments', async (req, res) => {
        const appointment = req.body;
        const result = await appointmentsCollection.insertOne(appointment);
        res.json(result);
    });
    
    app.put('/appointments/:id', async(req, res)=>{
        const id = req.params.id;
        const payment = req.body;
        const filter = {_id: ObjectId(id)};
        const updateDoc = {
            $set:{
                payment: payment
            }
        };
        const result = await appointmentsCollection.updateOne(filter, updateDoc);
        res.json(result);
    });

    app.get('/doctors', async(req, res)=>{
const coursor = doctorCollection.findOne({});
const doctors = await coursor.toArray();
res.json(doctors); 
    });

    app.post('/doctors', async(req, res)=>{
const name= req.body;
const email= req.body;
const pic = req.fiels.image;
const picdata = pic.data;
const encodePic = picdata.toString('base64');
const imageBuffer = Buffer.from(encodePic, 'base64');
const doctor = {
    name,
    email,

    imageBuffer
};
const result = await doctorCollection.insertOne(doctor);
res.json(result);

    });

    app.get('/users/:email', async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let isAdmin = false;
        if (user?.role === 'admin') {
            isAdmin = true;
        };
        res.json({ admin: isAdmin });
    });

    app.post('/users', async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        console.log(result);
        res.json(result);
    });

    app.put('/users', async (req, res) => {
        const user = req.body;
        const filter = { email: user.email };
        const options = { upsert: true };
        const updateDoc = { $set: user };
        const result = await usersCollection.updateOne(filter, updateDoc, options);
        res.json(result);
    });

  
    app.put('/users/admin', verifyToken, async (req, res) => {
        const user = req.body;
        const requester = req.decodedEmail;
        if (requester) {
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: user.email };
                const updateDoc = { $set: { role: 'admin' } };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.json(result);
            };
        }
        else {
            res.status(403).json({ message: 'you do not have access to make admin' });
        };

    });

    app.post('create/payment-intent', async(req, res)=>{
        const paymentInfo = req.body;
        const amount = paymentInfo.price*100;
        const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: amount,
            payment_method_types: [
                card
            ]
        });
        res.send({
            clientSecret: paymentIntent.client_secret,
          });
    });


    } finally {
      // Ensures that the client will close when you finish/error
    //   await client.close();
    }
  }
  run().catch(console.dir);

app.get('/', (req, res)=>{
    console.log('start');
    res.send('doctor portal');
});

app.listen(port, ()=>{
    console.log('doctore server running', port);
});