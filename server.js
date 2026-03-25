require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files (index.html, etc.)
app.use(express.static(path.join(__dirname)));

const SECRET_KEY = process.env.JWT_SECRET || "your_super_secret_key_here";

// Database Connection
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://neondb_owner:npg_MT6L0YvbeUax@ep-floral-dawn-a5asv22n-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: {
    rejectUnauthorized: false
  }
});

// 3. Health Check
app.get('/health', (req, res) => {
    res.send("Server is healthy and awake!");
});

// 4. REGISTER ROUTE
app.post('/register', async (req, res) => {
    const { username, password, email, phone, dob } = req.body;
    try {
        // We add email, phone, and dob to the query
        await pool.query(
            'INSERT INTO users (username, password, email, phone, dob) VALUES ($1, $2, $3, $4, $5)',
            [username, password, email, phone, dob]
        );
        res.status(201).json({ message: "User registered!" });
    } catch (err) {
    console.error(err); // This prints the REAL error in your Render/VS Code terminal
    res.status(500).json({ error: err.message }); // This sends the REAL error to your browser alert
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
        console.error("LOGIN ERROR:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});
app.post('/reset-password-verify', async (req, res) => {
    const { username, email, dob } = req.body;
    const user = await pool.query(
        'SELECT * FROM users WHERE username = $1 AND email = $2 AND dob = $3',
        [username, email, dob]
    );

    if (user.rows.length > 0) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Verification failed. Details do not match." });
    }
});
app.put('/update-password', async (req, res) => {
    const { username, newPassword } = req.body;
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newPassword, username]);
    res.json({ message: "Password updated!" });
});
// 6. FETCH TASKS (Protected)
app.get('/my-tasks', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY);
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
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY);
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
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY);
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
// GET USER DETAILS FOR PROFILE
app.get('/me', async (req, res) => {
    // 1. Get the token from the request header
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        // 2. Decode the token to find the User ID
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // 3. Query the database for that specific ID
        const result = await pool.query(
            'SELECT username, email, phone, dob FROM users WHERE id = $1', 
            [decoded.userId]
        );

        if (result.rows.length > 0) {
            // 4. Send the user object back to the frontend
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

// 9. HISTORY ROUTE (since frontend calls it)
app.get('/history', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No Token Provided");

    try {
        const verified = jwt.verify(token.split(" ")[1], SECRET_KEY);
        const result = await pool.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
            [verified.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
});
// 10. GET HISTORY (Read all tasks for the logged-in user)
app.get('/history', async (req, res) => {
    // 1. Get the token from the request header
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token, authorization denied" });

    try {
        // 2. Extract the token (removing "Bearer " prefix)
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // 3. Query the database for this specific user's tasks
        const result = await pool.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
            [decoded.userId]
        );

        // 4. Send the rows back to the frontend
        res.json(result.rows);
    } catch (err) {
        console.error("History Error:", err.message);
        res.status(401).json({ error: "Token is not valid" });
    }
});
// 1. DELETE ALL HISTORY (Clear Task Table for User)
app.delete('/clear-history', async (req, res) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        await pool.query('DELETE FROM tasks WHERE user_id = $1', [decoded.userId]);
        res.json({ message: "History cleared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear history" });
    }
});

// 2. DELETE ACCOUNT (Permanent Removal)
app.delete('/delete-account', async (req, res) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // We delete tasks first, then the user
        await pool.query('DELETE FROM tasks WHERE user_id = $1', [decoded.userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [decoded.userId]);
        
        res.json({ message: "Account deleted permanently" });
    } catch (err) {
        res.status(500).json({ error: "Could not delete account" });
    }
});
app.post('/reset-password-verify', async (req, res) => {
    const { username, email, dob } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND email = $2 AND dob = $3',
            [username, email, dob]
        );

        if (result.rows.length > 0) {
            res.json({ success: true, message: "Identity Verified" });
        } else {
            res.status(401).json({ error: "Details do not match our records." });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});
app.put('/update-password-final', async (req, res) => {
    const { username, newPassword } = req.body;
    try {
        await pool.query(
            'UPDATE users SET password = $1 WHERE username = $2',
            [newPassword, username]
        );
        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Could not update password" });
    }
});
// Catch-all route to serve index.html for any other request (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// MIDDLEWARE: Check if user is logged in
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Use the middleware for private routes
app.get('/me', authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT username, email, phone, dob FROM users WHERE id = $1', [req.user.userId]);
    res.json(result.rows[0]);
});

// Export for Vercel
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}