const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const express = require('express')
const app = express()
const port = process.env.PORT || 8000
const dotenv = require('dotenv')
const cors = require('cors');
const { jwtVerify, createRemoteJWKSet } = require('jose-cjs');
dotenv.config();
app.use(cors())
app.use(express.json())


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

  // console.log(authorization)

  const token = authorization?.split(' ')[1]
  // console.log(token)

  if (!token) {
    return res.status(401).json({ message: "unauthorize" })
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    )
    const { payload } = await jwtVerify(token, JWKS)
    // console.log(payload)
    req.user = payload
    // console.log(req.user)

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
    const enrollmentCollection = db.collection('enrollments')



    app.get('/tutors', async (req, res) => {

      const { search } = req.query;
      let cursor;
      if (search) {
        cursor = tutorDataCollection.find({ name: {
          $regex: search,
          $options: 'i'
        } })
      } else {
        cursor = tutorDataCollection.find()
      }

      const result = await cursor.toArray()
      // console.log(result)

      res.send(result)
    })


    app.post('/tutors', async (req, res) => {
      const newTutors = req.body
      // console.log(newTutors)
      const result = await tutorDataCollection.insertOne({
        ...newTutors,
        regDate: new Date(),
      });
      res.send(result)


    })

    app.get('/limit-tutors', async (req, res) => {
      const cursor = tutorDataCollection.find().limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/tutors/:tutorsId', async (req, res) => {
      const { tutorsId } = req.params
      // console.log(tutorsId)
      const query = { _id: new ObjectId(tutorsId) }
      const result = await tutorDataCollection.findOne(query)
      res.send(result)
    })


    app.get('/enrollment/:userId', verifyToken, async (req, res) => {
      const { userId } = req.params
      const result = await enrollmentCollection.find({ userId: userId }).toArray()
      res.send(result)
    })



    app.patch('/enrollment/:tutorsId', verifyToken, async (req, res) => {
      const { tutorsId } = req.params;
      const enrollmentData = req.body;

      // console.log("Tutor ID:", tutorsId);
      // console.log("Enrollment Data:", enrollmentData)

      const tutor = await tutorDataCollection.findOne({
        _id: new ObjectId(tutorsId),
      });
      // console.log("Tutor Found:", tutor)

      if (!tutor) {
        return res.status(404).json({
          success: false,
          message: "Tutor not found",
        });
      }

      if (tutor.remaining_slot <= 0) {
        return res.status(400).json({
          success: false,
          message: "No slots available",
        });
      }

      // duplicate booking check
      const alreadyBooked = await enrollmentCollection.findOne({
        userId: enrollmentData.userId,
        tutorName: enrollmentData.tutorName,
      });

      if (alreadyBooked) {
        return res.status(400).json({
          success: false,
          message: "You already booked this tutor",
        });
      }

      await enrollmentCollection.insertOne({
        ...enrollmentData,
        status: "active",
        enrolledAt: new Date(),
      });

      await tutorDataCollection.updateOne(
        { _id: new ObjectId(tutorsId) },
        {
          $inc: {
            remaining_slot: -1,
          },
          $set: {
            lastEnrolledAt: new Date(),
          },
        }
      );

      res.send({
        success: true,
        message: "Booking successful",
      });
    });

    app.patch('/enrollment/cancel/:id', async (req, res) => {
      const { id } = req.params;

      const result = await enrollmentCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "Cancelled"
          }
        }
      );

      res.send(result);
    });
    

    app.delete('/tutors/:id', async (req, res) => {
      const { id } = req.params;

      const result = await tutorDataCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });



    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
