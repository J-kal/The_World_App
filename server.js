const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve Highcharts modules from node_modules, specifically for the browser to access.
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Route to serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server and listen on all available network interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`App listening at http://localhost:${port}`);
});
