const jsonServer = require('json-server');
const jsonServerAuth = require('json-server-auth');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Crear router con datos en memoria
const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, '../db.json')));
const router = jsonServer.router(dbData);

const server = jsonServer.create();
const middlewares = jsonServer.defaults();

// Inicializar la base de datos para json-server-auth
server.db = router.db;

// Cargar reglas de permisos desde routes.json
const rules = jsonServerAuth.rewriter(JSON.parse(fs.readFileSync(path.join(__dirname, '../routes.json'))));

server.use(middlewares);

server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Expose-Headers', 'X-Total-Count, X-Total-Pages');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

server.use(rules);
server.use(jsonServer.rewriter({
    '/api/*': '/$1',
    '/blog/:resource/:id/show': '/:resource/:id'
}));

server.use(jsonServerAuth);

server.use((req, res, next) => {
    if (req.method === 'GET' && req.path === '/products') {
        const totalItems = server.db.get('products').size().value();
        const limit = parseInt(req.query._limit, 10) || totalItems;
        const totalPages = Math.ceil(totalItems / limit);
        res.setHeader('X-Total-Pages', totalPages);
    }
    next();
});

server.use(router);

server.post('/register', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = server.db.get('users').value();
    const userExists = users.some(user => user.email === email);

    if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 5);
    const newUser = { id: Date.now(), email, password: hashedPassword, name: name || '' };

    server.db.get('users').push(newUser).write();
    res.status(201).json(newUser);
});

module.exports = server;