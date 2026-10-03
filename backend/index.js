import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import routes from './routes.js';
import employerRoutes from './employerRoutes.js';
import { bot, APP_URL } from './bot.js';
import userRoutes from './userRoutes.js';
import { cleanupOldWeeks } from './scheduler.js';
import './handlers.js';

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function keepAlive() {
    const { error } = await supabase
        .from('keep_alive')
        .insert({ created_at: new Date().toISOString() });

    if (error) {
        console.error('Ошибка keep-alive:', error);
    } else {
        console.log('Keep-alive: запись добавлена');
    }
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(employerRoutes);
app.use(userRoutes);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Бэкенд запущен на http://0.0.0.0:${PORT}`);

    keepAlive();
    setInterval(keepAlive, 24 * 60 * 60 * 1000);

    cleanupOldWeeks();
    setInterval(cleanupOldWeeks, 24 * 60 * 60 * 1000);
});