const express = require('express')
const pool = require('./db/connection')

const app = express();

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.get('/', (req, res) => {
    console.log("Funcionando")
})

app.post('/api/v1/cars', async (req, res) => {
    const brand = req.body.brand
    const model = req.body.model
    const year = req.body.year
    const items = req.body.items

    // verificação campos obrigatórios
    if (!brand || brand.trim() === '') {
        return res.status(400).json({ message: "brand is required" });
    } else if (!model || model.trim() === '') {
        return res.status(400).json({ message: "model is required" });
    } else if (!year) {
        return res.status(400).json({ message: "year is required" });
    } 
    else if (!items || items.length === 0) {
        return res.status(400).json({ message: "items is required" });
    }

    // verificacao ano
    if (parseInt(year) < 2015 || parseInt(year) > 2025) {
        return res.status(400).json({ message: "year should be between 2015 and 2025" });
    }

    // verificacao de carro existente
    const sqlVerifyAlredyExistCar = `SELECT * FROM cars WHERE (brand = '${brand}') AND (model = '${model}') AND (year = '${year}')`
    pool.query(sqlVerifyAlredyExistCar, function(err, data){
        if(err) {
            console.log(err)
        }

        if(data.length !=0) {
            res.status(409).json({ message: "there is already a car with this data" });
            return
        } else {
            // insere o novo carro
            const sqlCreateCar = `INSERT INTO cars (brand, model, year) VALUES ('${brand}', '${model}', ${year})`
            pool.query(sqlCreateCar, (err, result)=>{
                if(err) {
                    console.log(err)
                }
                const carId = result.insertId
                res.status(201).json({id: carId})

                const uniqueItems = [...new Set(items.map(item => item.trim()))];

                // Inserir os itens do carro
                const sqlInsertItems = `INSERT INTO cars_items (name, car_id) VALUES ?`
                const values = uniqueItems.map(item => [item, carId])
    
                pool.query(sqlInsertItems, [values], (err) => {
                    if (err) {
                        console.error(err);
                    }
                }
            )})
        }
    })
})

app.listen(3000)