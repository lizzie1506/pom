const cors = require('cors');
app.use(cors()); // This allows ANY website to talk to your server
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Replace with your "Connection String" from the Neon Dashboard
const pool = new Pool({
  connectionString: 'postgresql://user:password@your-neon-url.neon.tech/neondb?sslmode=require',
});

// The "CREATE" Route: Saves the task when the button is clicked
app.post('/start-task', async (req, res) => {
    const { taskName } = req.body;
    const result = await pool.query(
        'INSERT INTO tasks (task_name) VALUES ($1) RETURNING *', 
        [taskName]
    );
    res.json(result.rows[0]);
});
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs'); // For scrambling passwords
const jwt = require('jsonwebtoken'); // For creating "Digital ID Cards"


const SECRET_KEY = "your_super_secret_key_here"; // Keep this private!

app.use(cors({
    origin: 'http://your-pomo-app.vercel.app' // Replace with your actual Vercel URL
}));
app.use(express.json());


// 2. REGISTER ROUTE: Create a new user
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Scramble the password 10 times for high security
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        res.json({ message: "User created!", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Username might already exist." });
    }
});

// 3. LOGIN ROUTE: Verify user and give them a Token
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userResult.rows.length === 0) return res.status(400).send("User not found");

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (isMatch) {
        // Create a Token (Digital ID) that expires in 2 hours
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ token });
    } else {
        res.status(400).send("Invalid password");
    }
});

// 4. PROTECTED ROUTE: Save task only if user is logged in
app.post('/start-task', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Access Denied: No Token Provided");

    try {
        // Verify the "ID Card"
        const verified = jwt.verify(token, SECRET_KEY);
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
// GET ROUTE: Fetch all tasks for the logged-in user
app.get('/my-tasks', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        // SQL query to select tasks by user_id, ordered by most recent
        const result = await pool.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
            [verified.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});
// DELETE ROUTE: Remove a specific task
app.delete('/delete-task/:id', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        const { id } = req.params; // Get the ID from the URL (e.g., /delete-task/5)
        
        // Only delete the task if it belongs to the logged-in user
        await pool.query(
            'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
            [id, verified.userId]
        );
        res.json({ message: "Task deleted successfully" });
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
