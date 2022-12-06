const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()

const jwt = require('jsonwebtoken');


app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.llsjgoo.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT (req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access')
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded
        next();
    })

}


async function run(){
    try{
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointOptions')

        const bookingCollection = client.db('doctorsPortal').collection('bookings')

        const usersCollection = client.db('doctorsPortal').collection('users')

        const doctorsCollection = client.db('doctorsPortal').collection('doctors')

        app.get('/appointmentOptions', async(req, res) =>{
            const date = req.query.date
            const query = {}
            const options = await appointmentOptionsCollection.find(query).toArray()
            const bookingQuery = {appointmentDate: date

            }
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray()
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                // console.log(optionBooked)
                const bookedSlots = optionBooked.map(book => book.slot)
                // console.log(option.name, bookedSlots)
                const remaningSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                // console.log(option.name, date, remaningSlots.length)

                option.slots = remaningSlots

            })
            res.send(options)
        });

        app.get('/appointmentSpeciality', async(req, res) =>{
            const query = {}
            const result = await appointmentOptionsCollection.find(query).project({name: 1}).toArray()
            res.send(result)
        })

        app.post('/bookings', async(req, res) =>{
            const booking = req.body
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment,
                email: booking.email
            }

            const allreadyBooked = await bookingCollection.find(query).toArray()
            if(allreadyBooked.length){
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({acknowledge: false, message})
            }

            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })


        app.get('/bookings', verifyJWT, async(req, res) =>{
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbeden access'})
            }
            const query = {email: email};
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings)
        
        })


        app.get('/jwt', async(req, res) =>{
            const email = req.query.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            if(user && user.email){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'})
                return res.send({accessToken: token})
            }
            console.log(user)
            res.status(403).send({accessToken: ''})

        })

        app.get('/users', async(req, res) =>{
            const query = {};
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })


        app.get('/users/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const query = {email}
            const user = await usersCollection.findOne(query)
            res.send( {isAdmin: user?.role === 'Admin'} )
        })


        app.put('/users/admin/:id', verifyJWT, async(req, res) =>{
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail}
            const user = await usersCollection.findOne(query)

            if(user?.role !== 'Admin'){
                return res.status(403).send({message: 'forbiden access'})
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id)}
            const options = {upsert: true}
            const updatedDoc ={
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send (result)
        })
      


        app.post('/users', async(req, res) =>{
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        app.post('/doctors', async(req, res) =>{
            const doctor = req.body
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })


    }
    finally{

    }
}

run().catch(console.log)

app.get('/', async(req, res) =>{
    res.send('Doctors portal server is running');
})

app.listen(port, () =>{
    console.log(`Doctors portal running on : ${port}`)
})