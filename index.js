const express = require('express')
const pool = require('./db/connection')

const app = express();

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.get('/api/v1/cars', (req, res) => {
    // receber o número de páginas da URL e limit, quando não é enviado o valor padrão é 1
    const { page = 1} = req.query
    let { limit } = req.query

    const { brand, model, year } = req.query

    if (limit < 1 || limit == undefined) { // verificacao de limit
        limit = 5
    } else if (limit > 10) {
        limit = 10
    }

    // calcular a partir de qual item deve retornar
    const offset = ((page * limit) - limit)

    // numero da ultima página
    let lastPage = 1

    // array de filtros e valores que forem passados
    let filters = []
    let values = []
    if (brand) {
        filters.push("brand LIKE ?")
        values.push(`%${brand}%`)
    }
    if (model) {
        filters.push("model LIKE ?")
        values.push(`%${model}%`)
    }
    if (year) {
        filters.push("year = ?")
        values.push(year)
    }

    let whereDinamic = ""

    // se tiver filtros nos parametros, entra nesse if e executa o where like
    // se não, executa a busca normal com todos os carros
    if (filters.length > 0) {
        whereDinamic = `WHERE ${filters.join(" AND ")}`

        const sqlCountCarsFilters = `SELECT COUNT(*) AS total FROM cars ${whereDinamic}`;
        pool.query(sqlCountCarsFilters, values, (err, countResult) => {
            if(err) {
                console.log(err)
            }

            const countCarsFilters = countResult[0].total

            lastPage = Math.ceil(countCarsFilters / limit)
            
            const sqlGetCarsLike = `SELECT * FROM cars ${whereDinamic} LIMIT ? OFFSET ?`

            values.push(parseInt(limit), parseInt(offset)) // adiciona ao array de valores: limit e offset
            
            pool.query(sqlGetCarsLike, values, (err, data) => {
                if(err) {
                    console.log(err)
                }

                const carsLike = data

                if(carsLike.length != 0) {
                    res.status(200)
                    return res.json({
                        count: countCarsFilters, 
                        pages: lastPage,
                        data: carsLike,
                    }).end()
                } else {
                    res.status(204).end()
                }
            })
        })
    } else {
        const sqlCountCars = `SELECT COUNT (*) AS total FROM cars`
        pool.query(sqlCountCars, (err, countResult) => {
            if(err) {
                console.log(err)
            }

            const countCars = countResult[0].total

            lastPage = Math.ceil(countCars / limit)

            const sqlGetCars = `SELECT * FROM cars LIMIT ${limit} OFFSET ${offset}`
            pool.query(sqlGetCars, (err, data) => {
                if(err) {
                    console.log(err)
                }
            
                const cars = data
                if (cars.length !=0) {
                    res.status(200)
                    return res.json({
                        count: countCars, 
                        pages: lastPage,
                        data: cars,
                    }).end()
                } else {
                    res.status(204).end()
                }
            })
        })
    }   
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

app.get('/api/v1/cars/:id', (req, res) => {
    const id = req.params.id

    const sqlSelectCarById = `SELECT C.id, C.brand, C.model, C.year, I.name as items FROM cars C LEFT JOIN cars_items I ON C.id = I.car_id WHERE C.id = ${id}`
    pool.query(sqlSelectCarById, (err, data) => {
        if(err) {
            console.log(err)
        }
        
        if (!data.length != 0) {
            res.status(404).json({message: "car not found"})
            return
        }

        const formattedData = JSON.parse(JSON.stringify(data))

        // montando a resposta
        const car = {
            id: formattedData[0].id,
            brand: formattedData[0].brand,
            model: formattedData[0].model,
            year: formattedData[0].year,
            items: formattedData.map(row => row.items)
        }

        res.status(200).json(car)
    })
})

app.delete('/api/v1/cars/:id', (req, res) => {
    const id = req.params.id

    const sqlVerifyCar = `SELECT * FROM cars WHERE id = '${id}'`
    pool.query(sqlVerifyCar, (err, data) => {
        if(err) {
            console.log(err)
        }

        if(!data.length != 0) {
            return res.status(404).json({message: "car not found"})
        }

        const sqlDeleteCarById = `DELETE FROM cars WHERE id = ${id}`
        pool.query(sqlDeleteCarById, (err) => {
            if(err) {
                console.log(err)
            }

            res.status(204)
            res.end()
        })
    })
})

app.patch('/api/v1/cars/:id', async (req, res) => {
    const id = req.params.id

    const brand = req.body.brand
    const model = req.body.model
    const year = req.body.year
    const items = req.body.items

    const sqlVerifyCar = `SELECT * FROM cars WHERE id = '${id}'`
    pool.query(sqlVerifyCar, (err, data) => {
        if (err) {
            console.log(err)
        }

        if (!data.length != 0) {
            res.status(404).json({message: "car not found"})
            return
        }

        if (parseInt(year) < 2015 || parseInt(year) > 2025) {
            return res.status(400).json({ message: "year should be between 2015 and 2025" });
        }

        // verificando carro já existente
        const sqlVerifyAlredyExistCar = `SELECT * FROM cars WHERE (brand = '${brand}') AND (model = '${model}') AND (year = '${year}')`
        pool.query(sqlVerifyAlredyExistCar, (err, data) => {
            if (err) {
                console.log(err)
            }

            if(data.length !=0) {
                res.status(409).json({ message: "there is already a car with this data" });
                return
            }

            const validData = {}

            if(brand && brand.trim()) validData.brand = brand
            if(model && model.trim()) validData.model = model
            if(year !== undefined && year !== null) validData.year = year

            if (Object.keys(validData).length > 0) {
                // fazendo uma query dinamica para aceitar somente dados que não são nulos e vazios
                const fields = Object.keys(validData).map((field) => `${field} = ?`).join(', ')
                const values = Object.values(validData)
            
                const sqlUpdateCar = `UPDATE cars SET ${fields} WHERE id = '${id}'`
                pool.query(sqlUpdateCar, values, (err) => {
                    if (err) {
                        console.log(err)
                    }                
                })
            }
            

            if (items && Array.isArray(items)) {
                const uniqueItems = [...new Set(items.filter(item => item && item.trim()))];

                if(uniqueItems.length > 0) {
                    // remove os itens antigos
                    const sqlDeleteItems = `DELETE FROM cars_items WHERE car_id = ?`;
                    pool.query(sqlDeleteItems, [id], (err) => {
                        if(err) {
                            console.log(err)
                        }
                    })

                    const values = uniqueItems.map(item => [item.trim(), id]);
                    console.log(values)

                    const sqlInsertItems = `INSERT INTO cars_items (name, car_id) VALUES ?`
                    pool.query(sqlInsertItems, [values], (err) => {
                        if(err) {
                            console.log(err)
                        }
                    })
                }
            }
            res.status(204)
            res.end()
        })
    })
})

app.listen(3000)