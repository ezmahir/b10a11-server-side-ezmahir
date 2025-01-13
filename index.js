const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j2k0a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // artifacts related apis
    const artifactsCollection = client
      .db("artifactsDB")
      .collection("artifacts");
    const artifactsLikesCollection = client
      .db("artifactsDB")
      .collection("artifactLikes");

    app.get("/artifacts", async (req, res) => {
      const cursor = artifactsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/artifacts", async (req, res) => {
      const newArtifact = req.body;
      const result = await artifactsCollection.insertOne(newArtifact);
      res.send(result);
    });

    app.get("/artifacts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artifactsCollection.findOne(query);
      res.send(result);
    });

    app.post("/artifactLikes", async (req, res) => {
      const like = req.body;
      const result = await artifactsLikesCollection.insertOne(like);
      res.send(result);
    });

    app.get("/artifactLikes", async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const result = await artifactsLikesCollection.find(query).toArray();
      for (const like1 of result) {
        // console.log(like1.like_id);
        const query1 = { _id: new ObjectId(like1.like_id) };
        const like = await artifactsCollection.findOne(query1);
        if (like) {
          like1.artifact_image = like.artifact_image;
          like1.like_count = like.like_count;
          // console.log(like);
        }
      }
      res.send(result);
    });

    // app.get("/artifactLikes/likes/:user_email", async (req, res) => {
    //   const userEmail = req.params.user_email;
    //   const query = { user_email: userEmail };
    //   const result = await artifactsLikesCollection.find(query).toArray();
    //   res.send(result);
    // });

    // app.get("/artifactLikes/likes/:like_id", async (req, res) => {
    //   const likeId = req.params.like_id;
    //   const query = { like_id: likeId };
    //   const result = await artifactsLikesCollection.find(query).toArray();
    //   res.send(result);
    // });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is waiting at: ${port}`);
});
