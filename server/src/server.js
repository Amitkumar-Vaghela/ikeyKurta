import express from 'express';
import cors from "cors";
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Postgres connection using Neon
const sql = neon('postgresql://ikeykurtaPU_owner:ApYc9QlG2uEM@ep-small-heart-a7zclizp.ap-southeast-2.aws.neon.tech/ikeykurtaPU?sslmode=require');

// Nodemailer transport configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ikeykurta@gmail.com',
        pass: process.env.GMAIL_PASSWORD // Use Gmail app password
    },
});

// Function to create the `invoice` table if it doesn't exist
async function initializeDatabase() {
    await sql(`
        CREATE TABLE IF NOT EXISTS invoice (
            id SERIAL PRIMARY KEY,
            firstName VARCHAR(255) NOT NULL,
            lastName VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL CHECK (email LIKE '%@paruluniversity.ac.in'),
            mobile VARCHAR(15) NOT NULL,
            productType VARCHAR(50)[] NOT NULL CHECK (array_length(productType, 1) > 0),
            qty INTEGER[] NOT NULL CHECK (array_length(qty, 1) > 0),
            price NUMERIC[] NOT NULL CHECK (array_length(price, 1) > 0),
            total NUMERIC NOT NULL,
            invoiceId VARCHAR(50) UNIQUE NOT NULL
        );
    `);
}

// Call the initializeDatabase function to create the table
initializeDatabase();

// Helper function to validate request body fields
function validateFields(fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (!value || (Array.isArray(value) && value.length === 0)) {
            throw new Error(`${key} cannot be empty`);
        }
    }
}

// Route to create an invoice and send it via email
app.post('/invoice', async (req, res) => {
    try {
        const { firstName, lastName, email, mobile, productType, qty, price } = req.body;

        // Validate that all fields are provided
        validateFields({ firstName, lastName, email, mobile, productType, qty, price });

        // Ensure productType, qty, and price arrays have the same length
        if (productType.length !== qty.length || productType.length !== price.length) {
            throw new Error('Product types, quantities, and prices must match in length');
        }

        // Calculate total price
        const total = qty.reduce((acc, cur, index) => acc + cur * price[index], 0);

        // Generate a unique invoice ID
        const invoiceId = 'iKey-' + Math.random().toString(36).substr(2, 9);

        // Insert into Postgres
        await sql(
            `INSERT INTO invoice (firstName, lastName, email, mobile, productType, qty, price, total, invoiceId)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [firstName, lastName, email, mobile, productType, qty, price, total, invoiceId]
        );

        // Prepare email content
        const mailOptions = {
            from: 'ikeykurta@gmail.com', // Sender email
            to: email, // Receiver email from the body
            subject: 'Your Invoice from iKeyKurta',
            text: `
                Hello ${firstName} ${lastName},
                
                Thank you for your purchase! Here are the details of your invoice:
                
                Invoice ID: ${invoiceId}
                Products: ${productType.join(', ')}
                Quantities: ${qty.join(', ')}
                Prices: ${price.join(', ')}
                Total: INR ${total.toFixed(2)}
                
                We hope to see you again soon!
                
                Regards,
                iKeyKurta
            `,
        };

        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Email error: ', error);
                return res.status(500).json({ error: error.message });
            } else {
                console.log('Email sent: ' + info.response);
                return res.status(201).send("Invoice created and email sent successfully");
            }
        });

    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

// Root route
app.get('/', (req, res) => {
    res.send("Welcome to iKeyKurta API");
});

// Start the server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
