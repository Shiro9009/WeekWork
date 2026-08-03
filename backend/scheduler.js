import { supabase } from "./index.js";
import { bot, APP_URL } from "./bot.js";

export function getNextWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(d.setDate(diff));
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return nextMonday.toISOString().split('T')[0];
}

export function cleanPhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}

export async function generationSchedule(employerId, weekStart) {
    console.log('Генерация расписания для ', employerId);

    const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, name')
        .eq('employer_id', employerId)
        .eq('role', 'worker');

    if (workersError || !workers || workers.length === 0) {
        console.log('Нет работников');
        return;
    }

    const workerIds = workers.map(w => w.id);

    const { data: availability, error: availabilityError } = await supabase
        .from('weekly_availability')
        .select('worker_id, days')
        .eq('week_start', weekStart)
        .in('worker_id', workerIds);

    if (availabilityError || !availability) {
        console.log('Нет данных о выборе дней');
        return;
    }

    const availabilityMap = {};
    for (const item of availability) {
        availabilityMap[item.worker_id] = item.days;
    }

    const schedule = generateSimpleSchedule(workers, availabilityMap);

    const { error: insertError } = await supabase
        .from('shift_options')
        .insert({
            employer_id: employerId,
            week_start: weekStart,
            option_number: 1,
            schedule: schedule
        });

    if (insertError) {
        console.log('Ошибка сохранения расписания', insertError);
        return;
    }

    console.log('Расписание сохранено');

    const { data: employer, error: employerError } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('id', employerId)
        .single();

    if (!employerError && employer) {
        const employerTelegramId = employer.telegram_id;
        await bot.sendMessage(
            employerTelegramId,
            'Все работники выбрали дни! Варианты расписания готовы.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Посмотреть варианты', web_app: { url: APP_URL } }]
                    ]
                }
            }
        );
        console.log('Уведомление отправлено работодателю');
    } else {
        console.log('Не удалось найти работодателя');
    }
}

function generateSimpleSchedule(workers, availabilityMap) {
    const daysOfWeek = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const schedule = {};

    for (const day of daysOfWeek) {
        const available = workers.filter(w => {
            const days = availabilityMap[w.id];
            return days && days[day] === 1;
        });

        if (available.length > 0) {
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            schedule[day] = shuffled.slice(0, 2).map(w => w.name);
        } else {
            const shuffled = [...workers].sort(() => Math.random() - 0.5);
            schedule[day] = shuffled.slice(0, 2).map(w => w.name);
        }
    }

    return schedule;
}