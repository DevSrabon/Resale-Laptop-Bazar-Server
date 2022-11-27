const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 8000;
const jwt = require("jsonwebtoken");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// middleware
require("dotenv").config();
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

function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).send("unauthorized access");
	}
	const token = authHeader.split(" ")[1];

	jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
		if (err) {
			return res.status(403).send({ message: "forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
  try {
    const homesCollection = client.db("laptopBazar").collection("homes")
    const productCollection = client.db("laptopBazar").collection("product")
    const usersCollection = client
			.db("laptopBazar")
			.collection("usersCollection");

    app.get('/homes', async (req, res) => {
      const query = {};
      const result = await homesCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/product', async (req, res) => {
      const query = {};
      const result = await productCollection.find(query).toArray();
      res.send(result);
    }); 

    app.post('/product', async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send({...result, ...req.body})
    });

    app.get('/product/:brand', async (req, res) => {
      const brand = req.params.brand;
      const filter = { brand: brand };
      const result = await productCollection.find(filter).toArray();
      res.send(result)
    });

    app.get("/jwt", async (req, res) => {
			const email = req.query.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			if (user) {
				const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
					expiresIn: "30d",
				});
				return res.send({ accessToken: token });
			}
			console.log(user);
			res.status(403).send({ accessToken: "" });
    });

    	app.post("/users", async (req, res) => {
				const user = req.body;
				const result = await usersCollection.insertOne(user);
				res.send(result);
			});
    
    app.get("/users", async (req, res) => {
			const query = {};
			const users = await usersCollection.find(query).toArray();
			res.send(users);
    });
    
    		app.delete("/users/:id", verifyJWT, async (req, res) => {
					const id = req.params.id;
					const filter = { _id: ObjectId(id)};
					const result = await usersCollection.deleteOne(filter);
					res.send({...result, ...req.body});
				});
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