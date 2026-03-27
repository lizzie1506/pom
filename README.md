POMOFOCUS: Anti Procrastination Wall
POMOFOCUS is a full-stack productivity application designed to enforce deep work through a "Hard-Lock" focus mechanism. Unlike standard timers, POMOFOCUS utilizes browser lifecycle hooks and challenge-based verification to prevent impulsive session interruptions.

A.Features:
Anti-Distraction "Hard Lock": Uses beforeunload listeners to prevent accidental tab closures or refreshes during active focus sessions.

Verification-Based Exit: Implements a "Math Challenge" gate that users must solve to manually break their focus, adding a cognitive barrier to quitting.

Full-Stack Authentication: Secure Login/Signup system with a Forgot Password flow integrated via Nodemailer (SMTP) and Gmail App Passwords.

Persistent Statistics: Real-time logging of "Started," "Completed," and "Cancelled" sessions into a PostgreSQL database.

Personal Dashboard: A dedicated User Profile section that fetches personal contact info and productivity metrics via REST API.

Responsive UI: A clean, minimalist "Dark Mode" aesthetic built with modern CSS Flexbox and Glassmorphism effects.

B.Tech Stack:
Layer	Technology
Frontend	HTML5, CSS3 (Flexbox/Grid), JavaScript (ES6+)
Backend	Node.js, Express.js
Database	PostgreSQL (Relational Database Management)
Email Service	Nodemailer (SMTP / Gmail API)
Deployment	Render (Web Services & Managed Database)

C.Project Structure
Plaintext
POMOFOCUS/
├── public/                 # Frontend files
│   ├── index.html          # Main application UI
│   ├── style.css           # Custom styling & Modals
│   └── script.js           # Timer logic & API fetching
├── server.js               # Express server & Database routes
├── package.json            # Node.js dependencies
└── .env                    # Environment variables (Secrets)

D.Setup & Installation
1. Database Setup
Run the following SQL commands in your PostgreSQL terminal to initialize the tables:

SQL
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    contact VARCHAR(15)
);

-- Timer History Table
CREATE TABLE timer_history (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username),
    status VARCHAR(20), -- 'completed', 'cancelled'
    task_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
2. Backend Configuration
Create a .env file in the root directory and add your credentials:

Code snippet
DATABASE_URL=your_postgresql_connection_string
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_digit_app_password
PORT=5000
3. Installation
Bash
# Clone the repository
git clone https://github.com/yourusername/mofocus.git

# Install dependencies
npm install

# Start the server
node server.js
