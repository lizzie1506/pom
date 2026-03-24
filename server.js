const express = require('express');
const cors = require('cors'); // 1. Import CORS
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 2. ENABLE CORS BEFORE ANY ROUTES
app.use(cors({
    origin: '*', // This allows ALL origins (good for testing)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // 3. Parse JSON after CORS

// 1. FIXED CORS: This allows your local computer AND your live site to connect
app.use(cors()); 

const SECRET_KEY = process.env.JWT_SECRET || "your_super_secret_key_here";

// 2. Database Connection
const { Pool } = require('pg');
const pool = new Pool({
  // REPLACED: Directly using your Neon connection string here
  connectionString: "postgres://neondb_owner:npg_MT6L0YvbeUax@ep-floral-dawn-a5asv22n-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: {
    rejectUnauthorized: false // Required for Neon + Render
  }
});

// 3. Health Check (To wake up the server)
app.get('/health', (req, res) => {
    res.send("Server is healthy and awake!");
});

// 4. REGISTER ROUTE
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Missing fields" });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        res.json({ message: "User created!", user: result.rows[0] });
    } catch (err) {
        console.error("DB ERROR:", err.message);
        res.status(500).json({ error: "Username might already exist or DB error" });
    }
});

// 5. LOGIN ROUTE
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (userResult.rows.length === 0) return res.status(400).json({ error: "User not found" });

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '2h' });
            res.json({ token, username: user.username });
        } else {
            res.status(400).json({ error: "Invalid password" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// 6. FETCH TASKS (Protected)
app.get('/my-tasks', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY); // Fixed: Added split for Bearer token
        const result = await pool.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
            [verified.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});

// 7. START/SAVE TASK (Protected)
app.post('/start-task', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY); // Fixed: Added split for Bearer token
        const { taskName } = req.body;
        
        const result = await pool.query(
            'INSERT INTO tasks (task_name, user_id) VALUES ($1, $2) RETURNING *',
            [taskName, verified.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});

// 8. DELETE TASK
app.delete('/delete-task/:id', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY); // Fixed: Added split for Bearer token
        const { id } = req.params;
        await pool.query(
            'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
            [id, verified.userId]
        );
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));