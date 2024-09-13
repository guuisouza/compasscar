const express = require('express')
const app = express();
const carRoutes = require('./routes/cars_routes');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/v1', carRoutes)

app.listen(3000)