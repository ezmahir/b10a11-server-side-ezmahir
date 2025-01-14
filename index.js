const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("token inside the verifyToken", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

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

    // Auth relatedA Apis
    app.post("jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          secure: false,
        })
        .send({ success: true });
    });

    app.get("/artifacts", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { added_email: email };
      }

      const cursor = artifactsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/artifactLimited", async (req, res) => {
      const cursor = artifactsCollection
        .find()
        .sort({ like_count: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/artifacts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artifactsCollection.findOne(query);
      res.send(result);
    });

    app.put("/artifacts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedArtifact = req.body;
      const artifact = {
        $set: {
          title: updatedArtifact.title,
          artifact_image: updatedArtifact.artifact_image,
          context: updatedArtifact.context,
          created_at: updatedArtifact.created_at,
          discovered_at: updatedArtifact.discovered_at,
          discovered_by: updatedArtifact.discovered_by,
          location: updatedArtifact.location,
        },
      };

      const result = await artifactsCollection.updateOne(
        filter,
        artifact,
        options
      );
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

      const id = like.like_id;
      const query = { _id: new ObjectId(id) };
      const artifact = await artifactsCollection.findOne(query);
      let newCount = 0;
      if (artifact.like_count) {
        newCount = artifact.like_count + 1;
      } else {
        newCount = 1;
      }

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          like_count: newCount,
        },
      };
      const updateResult = await artifactsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.get("/artifactLikes", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      try {
        const query = { user_email: email };
        if (req.user.email != req.query.email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const result = await artifactsLikesCollection.find(query).toArray();

        let finalResult = [];

        for (const like1 of result) {
          if (like1.like_id && ObjectId.isValid(like1.like_id)) {
            const query1 = { _id: new ObjectId(like1.like_id) };
            const likeResult = await artifactsCollection.findOne(query1);
            if (likeResult) {
              finalResult.push(likeResult);
            }
          } else {
            console.warn(`Invalid ObjectId: ${like1.like_id}`);
          }
        }

        res.send(finalResult);
      } catch (err) {
        console.error("Error fetching artifact likes:", err);
        res
          .status(500)
          .send({ error: "An error occurred while processing your request" });
      }
    });

    app.delete("/artifacts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artifactsCollection.deleteOne(query);
      res.send(result);
    });

    // app.get("/artifactLikes", async (req, res) => {
    //   const email = req.query.email;
    //   const query = { user_email: email };
    //   const result = await artifactsLikesCollection.find(query).toArray();

    //   let finalResult = [];

    //   for (const like1 of result) {
    //     // console.log(like1.like_id);
    //     const query1 = { _id: new ObjectId(like1.like_id) };
    //     const likeResult = await artifactsCollection.findOne(query1);
    //     if (likeResult) {
    //       finalResult.push(likeResult);
    //     }
    //     // console.log(likeResult);
    //     // if (like) {
    //     //   like1.artifact_image = like.artifact_image;
    //     //   like1.like_count = like.like_count;
    //     //   // console.log(like);
    //     // }
    //   }
    //   res.send(finalResult);
    // });

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
