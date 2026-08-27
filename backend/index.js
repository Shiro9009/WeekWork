import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import routes from './routes.js';
import employerRoutes from './employerRoutes.js';
import { bot, APP_URL } from './bot.js';
import userRoutes from './userRoutes.js';
import './handlers.js';

export const supabase = createClient(
    'https://uflyeztyiwgpginhvmuk.supabase.co',
    'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4'
);

const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(employerRoutes);
app.use(userRoutes);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Бэкенд запущен на http://0.0.0.0:${PORT}`);
});