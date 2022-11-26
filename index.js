const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 8000;
const jwt = require("jsonwebtoken");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// Database Connection
const uri =
	`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sajc8ea.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})

async function run() {
  try {
    const homesCollection = client.db("laptopBazar").collection("homes")
    const productCollection = client.db("laptop-bazar").collection("product")

    app.get('/homes', async (req, res) => {
      const query = {};
      const result = await homesCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/product', async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send({...result, ...req.body})
    })
  }
  finally {
    
  }
}
run().catch(err => console.dir(err))




app.get("/", (req, res) => {
	res.send("Server is running..... in session");
});

app.listen(port, () => {
	console.log(`Server is running..... on ${port}`);
});