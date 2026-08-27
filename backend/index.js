import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/user-role', (req, res) => {
    res.json({ role: 'employer' });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Бэкенд запущен на http://0.0.0.0:${PORT}`);
});