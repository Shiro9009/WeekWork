import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import routes from './routes.js';
import employerRoutes from './employerRoutes.js';
import { bot, APP_URL } from './bot.js';
import './handlers.js';

export const supabase = createClient(
    'https://uflyeztyiwgpginhvmuk.supabase.co',
    'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4'
);

const app = express();

// Полностью отключаем CORS
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Дополнительный middleware для любых заголовков
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(routes);
app.use(employerRoutes);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Бэкенд запущен на http://0.0.0.0:${PORT}`);
});