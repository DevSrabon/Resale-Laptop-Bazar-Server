const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 8000;
const jwt = require("jsonwebtoken");
const { query } = require("express");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


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
		const homesCollection = client.db("laptopBazar").collection("homes");
		const productCollection = client.db("laptopBazar").collection("product");
		const usersCollection = client
			.db("laptopBazar")
			.collection("usersCollection");
		const bookingCollection = client.db("laptopBazar").collection("bookings");

		const paymentsCollection = client.db("laptopBazar").collection("payments");

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
			res.status(403).send({ accessToken: "" });
		});

		//verifyAdmin
		const verifyAdmin = async (req, res, next) => {
			console.log("inside verifyAdmin", req.decoded);
			const decodedEmail = req.decoded.email;
			const query = { email: decodedEmail };
			const user = await usersCollection.findOne(query);
			if (user?.role !== "Admin") {
				return res.status(403).send({ message: "forbidden access" });
			}
			next();
		};
		//   verify Buyer
	  const verifyBuyer = async (req, res, next) => {
			console.log("inside verifyAdmin", req.decoded);
			const decodedEmail = req.decoded.email;
			const query = { email: decodedEmail };
			const user = await usersCollection.findOne(query);
			if (user?.role !== "Buyer") {
				return res.status(403).send({ message: "forbidden access" });
			}
			next();
		};
		//   verify seller
	  const verifySeller = async(req, res, next) => {
			console.log("inside verifySeller", req.decoded);
			const decodedEmail = req.decoded.email;
			const query = { email: decodedEmail };
			const user = await usersCollection.findOne(query);
			if (user?.role !== "Seller") {
				return res.status(403).send({ message: "forbidden access" });
			}
			next();
		};

		app.get("/users/admin/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await usersCollection.findOne(query);
			res.send({ isAdmin: user?.role === "Admin" });
		});

		app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					isVerified: "verified",
				},
			};
			const result = await usersCollection.updateOne(
				filter,
				updateDoc,
				options
			);
			res.send(result);
		});

		app.get("/users/seller/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await usersCollection.findOne(query);
			res.send({ isSeller: user?.role === "Seller" });
		});

		app.get("/users/buyer/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await usersCollection.findOne(query);
			res.send({ isBuyer: user?.role === "Buyer" });
		});

		app.get("/homes", async (req, res) => {
			const query = {};
			const result = await homesCollection.find(query).toArray();
			res.send(result);
		});

		//   products

		app.post("/product", verifyJWT, verifySeller, async (req, res) => {
			const product = req.body;
			const result = await productCollection.insertOne(product);
			res.send({ ...result, ...req.body });
		});
		app.post("/category", verifyJWT, verifyAdmin, async (req, res) => {
			const product = req.body;
			const result = await homesCollection.insertOne(product);
			res.send({ ...result, ...req.body });
		});

		app.get("/product/:brand", async (req, res) => {
			const brand = req.params.brand;
			const filter = { brand: brand };
			const products = await productCollection.find(filter).toArray();
			res.send(products);
		});

		app.get("/product", async (req, res) => {
			let query = {};
			if (req.query.email) {
				query = {
					email: req.query.email,
				};
			}
			const cursor = productCollection.find(query);
			const orders = await cursor.toArray();
			res.send(orders);
		});

		// create users
		app.post("/users", async (req, res) => {
			const user = req.body;
			const query = { email: user.email };
			const alreadyExist = await usersCollection.findOne(query);
			if (alreadyExist) {
				res.send(JSON.stringify({ message: "User already exists" }));
				return;
			}
			const result = await usersCollection.insertOne(user);
			res.send(result);
		});
		// get user
		app.get("/users", async (req, res) => {
			const query = {};
			const users = await usersCollection.find(query).toArray();
			res.send(users);
		});

		//   payment

        app.post("/create-payment-intent", async (req, res) => {
					const booking = req.body;
					const price = booking.price;
					const amount = parseFloat(price * 100);

					const paymentIntent = await stripe.paymentIntents.create({
						currency: "usd",
						amount: amount,
						payment_method_types: ["card"],
					});
					res.send({
						clientSecret: paymentIntent.client_secret,
					});
				});

		app.post("/payments", verifyJWT, async (req, res) => {
			const payments = req.body;
			const result = await paymentsCollection.insertOne(payments);
			const id = payments.bookingId;
			const filter = { _id: ObjectId(id) };
			const updateDos = {
				$set: {
					paid: true,
					transactionId: payments.transactionId,
				},
			};
			const updateResult = await bookingCollection.updateOne(filter, updateDos);
			res.send({ result, updateResult });
		});

		// booking
		app.post("/bookings", async (req, res) => {
			const booking = req.body;
			const result = await bookingCollection.insertOne(booking);
			res.send(result);
		});

		app.get("/bookings", async (req, res) => {
			// const email = req.query.email;
			// const decodedEmail = req.decoded.email;
			// if (email !== decodedEmail) {
			// 	return res.status(403).send({ message: "forbidden access" });
			// }
			let query = {};
			if (req.query.email) {
				query = {
					email: req.query.email,
				};
			}
			const cursor = bookingCollection.find(query);
			const orders = await cursor.toArray();
			res.send(orders);
		});

		app.get("/bookings/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const result = await bookingCollection.findOne(query);
			res.send(result);
		});

		// Advertise

		app.put("/advertise/:id", verifyJWT, verifySeller, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const options = { upsert: true };
			const updateDos = {
				$set: {
					advertise: "true",
				},
			};
			const result = await productCollection.updateOne(
				filter,
				updateDos,
				options
			);
			res.send(result);
		});
	  
// advertise product collection
		app.get("/products", async (req, res) => {
			let query = {};

			if (req.query.advertise) {
				query = { advertise: req.query.advertise };
			}
			const result = await productCollection
				.find(query)
				.sort({ date: -1 })
				.limit(3)
				.toArray();
			res.send(result);
		});

		//   put reports

		app.put("/users/report/:id", verifyJWT, verifyBuyer, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					report: "reported",
				},
			};
			const result = await productCollection.updateOne(
				filter,
				updateDoc,
				options
			);
			res.send(result);
		});

		// get reports

		app.get("/reports", verifyJWT, verifyAdmin, async (req, res) => {
			let query = {};
			if (req.query.report) {
				query = {
					report: req.query.report,
				};
			}
			const cursor = await productCollection.find(query).toArray();
			res.send(cursor);
		});

		//   delete product

		app.delete("/product/:id", verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await productCollection.deleteOne(filter);
			res.send({ ...result, ...req.body });
		});

		//   delete user
		app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await usersCollection.deleteOne(filter);
			res.send({ ...result, ...req.body });
		});
	  
	//   delete Booking
	  app.delete("/book/:id", verifyJWT, verifyBuyer, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await bookingCollection.deleteOne(filter);
			res.send({ ...result, ...req.body });
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