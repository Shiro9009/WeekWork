import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import routes from './routes.js';
import { bot, APP_URL } from './bot.js';
import './handlers.js';

export const supabase = createClient(
    'https://uflyeztyiwgpginhvmuk.supabase.co',
    'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4'
);

const app = express();

app.use(cors({
    origin: ['https://weekwork-app.vercel.app', 'https://t.me', 'https://web.telegram.org'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(routes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Бэкенд запущен на http://localhost:${PORT}`);
});