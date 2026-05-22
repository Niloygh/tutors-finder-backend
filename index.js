const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const express = require('express')
const app = express()
const port = process.env.PORT || 8000
const dotenv = require('dotenv')
const cors = require('cors');
const { jwtVerify, createRemoteJWKSet } = require('jose-cjs');
dotenv.config();
app.use(cors())



const uri = process.env.MONGODB_URI


const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(' ')[1]
  // console.log(token)

  if (!token) {
    return res.status(401).json({ message: "unauthorize" })
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL('http://localhost:3000/api/auth/jwks')
    )
    const { payload } = await jwtVerify(token, JWKS)
    // console.log(payload)
    req.user = payload
    console.log(req.user)

      next()
  } catch (error) {
    console.error('Token validation failed:', error)
    return res.status(401).json({ message: "unauthorize" })

  }


}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db('tutordb')
    const tutorDataCollection = db.collection('tutorData')

    app.get('/tutors', async (req, res) => {
      const cursor = tutorDataCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/limit-tutors', async (req, res) => {
      const cursor = tutorDataCollection.find().limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/tutors/:tutorsId', verifyToken, async (req, res) => {
      const { tutorsId } = req.params
      // console.log(tutorsId)
      const query = { _id: new ObjectId(tutorsId) }
      const result = await tutorDataCollection.findOne(query)
      res.send(result)

    })


    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
