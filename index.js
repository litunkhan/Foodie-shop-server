const express = require('express')
const cors = require('cors')
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const stripe = require('stripe')(`sk_test_51NFHLVLWlr5V7Bz71qFaH0NnUCfVe2YEzKB2ECjUIUiHrA7CR70iP1ozhSpkZgvqaXh3MtC0ch6F9UtvIx8M6MUK00sVwbofHe`)
require('dotenv').config();
const app = express()
app.use(cors())
app.use(express.json())




const verifyJwt = (req,res,next)=>{
  const authorization = req.headers.authorization

  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized user access'})
  }
  const token = authorization.split(' ')[1]
  jwt.verify(token,process.env.SECRET_KEY , (err,decoded)=>{
     if(err){
       return res.status(401).send({error:true,message:'unauthorized user access'})
     }
     req.decoded = decoded
     next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6scxok5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const allUserCollection = client.db('fodieshop').collection('allusers')
    const menuColloction = client.db('fodieshop').collection('menus')
    const allOrderCollection = client.db('fodieshop').collection('orders') 
    const paymentsCollection = client.db('fodieshop').collection('allpayments') 
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.get('/',(req,res)=>{
        res.send('app')
    })
    app.post('/menu', async(req,res)=>{
      const newitem = req.body
      const result = await menuColloction.insertOne(newitem)
      res.send(result)
  })

  app.get('/menu', async(req,res)=>{
    const result = await menuColloction.find().toArray()
    res.send(result)
})

app.delete('/menus/:id',verifyJwt, async(req,res)=>{
  const id = req.params.id
  const quiry = {_id: new ObjectId(id)}
  const result = await menuColloction.deleteOne(quiry)
  console.log(result,quiry)
  res.send(result)
})

    app.post('/user', async(req,res)=>{
        const user = req.body
        const query = {email:user.email}
        const exsistingUser = await allUserCollection.findOne(query)
        if(exsistingUser){
          return res.send('userAlredy exits')
        }
        const result = await allUserCollection.insertOne(user)
        res.send(result)
     })

     app.get('/alluser',verifyJwt,async(req,res)=>{
        const result = await allUserCollection.find().toArray()
        res.send(result)
     })

     app.post('/jwt',(req,res)=>{
      const user = req.body
      const token = jwt.sign(user,process.env.SECRET_KEY,{expiresIn:'10h'})
      res.send({token})
  })



  // post orders 

  app.post('/orders', async(req,res)=>{
    const item = req.body
    const result = await allOrderCollection.insertOne(item)
    res.send(result)
 })

 app.get('/orders',verifyJwt,async(req,res)=>{
  const email = req.query.email
  if(!email){
    res.send([])
  }
   const decodedEmail = req.decoded.email
   if(email !== decodedEmail){
     return res.status(403).send({error:true,message:'forbidden access'})
   }
   
  const quierys = {email:email}
  const result = await allOrderCollection.find(quierys).toArray()
  res.send(result)
})


app.delete('/orders/:id', async(req,res)=>{
  const id = req.params.id
  const query = {_id: new ObjectId(id)}
  const result = await allOrderCollection.deleteOne(query)
  res.send(result)
})

// payment 

app.post(`/create-payment-intent`, verifyJwt, async (req, res) => {
  const { prices } = req.body;
  const amount = prices * 100;
  console.log(prices*100,amount)

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ['card'], // Corrected property name
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    // Handle any errors that occur during the Stripe request
    res.status(500).send({
      error: error.message,
    });
  }
});


app.post('/payments', verifyJwt,async(req,res)=>{
    const paymentss = req.body
    const result = await paymentsCollection.insertOne(paymentss)
    const quiry = {_id:{$in:paymentss.item.map(id=> new ObjectId(id))}}
    const deleteResult = await allOrderCollection.deleteMany(quiry)
    res.send({result,deleteResult})
})


// admin know 
  app.patch('/user/admin/:id',async(req,res)=>{
    const id = req.params.id
    const filter = {_id: new ObjectId(id)}

    const updateDoc = {
       $set:{
         role:'admin'
       }
    }

    const result = await allUserCollection.updateOne(filter,updateDoc)
    res.send(result)
 })   

 app.get('/user/admin/:email',verifyJwt,async(req,res)=>{
     const email = req.params.email
     if(req.decoded.email !== email){
       res.send({admin:false})
     }
     const quiry = {email:email}
     const user = await allUserCollection.findOne(quiry)
     const result = {admin: user?.role ==='admin'}
     
     res.send(result)
 })

   
    app.listen(port,()=>{
        console.log('app is running')
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


