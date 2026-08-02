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
app.use(cors());
app.use(express.json());
app.use(routes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Бэкенд запущен на http://localhost:${PORT}`);
});