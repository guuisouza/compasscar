const express = require('express')
const pool = require('./db/connection')

const app = express();

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.get('/', (req, res) => {
    console.log("Funcionando")
})

app.listen(3000)