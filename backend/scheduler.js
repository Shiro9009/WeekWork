import { supabase } from "./index.js";
import { bot } from "./bot.js";

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
    console.log('Генерация расписания вызвана для:', employerId, weekStart);

    const { error: deleteError } = await supabase
        .from('shift_options')
        .delete()
        .eq('employer_id', employerId)
        .eq('week_start', weekStart);

    if (deleteError) {
        console.log('Ошибка удаления старых вариантов', deleteError);
        return;
    }

    const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, name, monthly_shifts')
        .eq('employer_id', employerId)
        .eq('role', 'worker')
        .eq('is_on_leave', false);

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

    for (let optionNumber = 1; optionNumber <= 3; optionNumber++) {
        const schedule = generateSchedule(workers, availabilityMap, optionNumber);

        const { data: existing } = await supabase
            .from('shift_options')
            .select('id')
            .eq('employer_id', employerId)
            .eq('week_start', weekStart)
            .eq('option_number', optionNumber)
            .single();

        if (!existing) {
            await supabase.from('shift_options').insert({
                employer_id: employerId,
                week_start: weekStart,
                option_number: optionNumber,
                schedule: schedule
            });
        } else {
            await supabase.from('shift_options')
                .update({ schedule: schedule })
                .eq('employer_id', employerId)
                .eq('week_start', weekStart)
                .eq('option_number', optionNumber);
        }
    }

    const { data: employer, error: employerError } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('id', employerId)
        .single();

    if (!employerError && employer) {
        await bot.sendMessage(
            employer.telegram_id,
            'Все работники выбрали дни! Варианты расписания готовы.'
        );
    }
}

function generateSchedule(workers, availabilityMap, optionNumber) {
    if (optionNumber === 1) {
        return generateOptimalSchedule(workers, availabilityMap);
    } else if (optionNumber === 2) {
        return generateBalancedSchedule(workers, availabilityMap);
    } else {
        return generateRandomSchedule(workers, availabilityMap);
    }
}

function generateOptimalSchedule(workers, availabilityMap) {
    const daysOfWeek = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const schedule = {};
    const shiftCount = {};
    workers.forEach(w => shiftCount[w.id] = 0);

    for (const day of daysOfWeek) {
        const priority = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 2 && shiftCount[w.id] < (w.monthly_shifts || 999);
        });

        const selected = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 1 && shiftCount[w.id] < (w.monthly_shifts || 999);
        });

        const unavailable = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 3;
        });

        let pool = [];

        if (priority.length > 0) {
            pool = priority;
        } else if (selected.length > 0) {
            pool = selected;
        } else {
            pool = workers.filter(w =>
                !unavailable.includes(w) &&
                shiftCount[w.id] < (w.monthly_shifts || 999)
            );
        }

        if (pool.length === 0) {
            schedule[day] = [];
            continue;
        }

        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const assigned = shuffled.slice(0, 1);

        schedule[day] = assigned.map(w => w.name);
        assigned.forEach(w => shiftCount[w.id]++);
    }

    return schedule;
}

function generateBalancedSchedule(workers, availabilityMap) {
    const daysOfWeek = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const schedule = {};
    const shiftCount = {};
    workers.forEach(w => shiftCount[w.id] = 0);

    for (const day of daysOfWeek) {
        const available = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status !== 3 && shiftCount[w.id] < (w.monthly_shifts || 999);
        });

        if (available.length === 0) {
            schedule[day] = [];
            continue;
        }

        available.sort((a, b) => shiftCount[a.id] - shiftCount[b.id]);

        const minCount = shiftCount[available[0].id];
        const leastLoaded = available.filter(w => shiftCount[w.id] === minCount);

        const shuffled = [...leastLoaded].sort(() => Math.random() - 0.5);
        const assigned = shuffled.slice(0, 1);

        schedule[day] = assigned.map(w => w.name);
        assigned.forEach(w => shiftCount[w.id]++);
    }

    return schedule;
}

function generateRandomSchedule(workers, availabilityMap) {
    const daysOfWeek = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const schedule = {};
    const shiftCount = {};
    workers.forEach(w => shiftCount[w.id] = 0);

    for (const day of daysOfWeek) {
        const priority = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 2 && shiftCount[w.id] < (w.monthly_shifts || 999);
        });

        const selected = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 1 && shiftCount[w.id] < (w.monthly_shifts || 999);
        });

        const unavailable = workers.filter(w => {
            const status = availabilityMap[w.id]?.[day] || 0;
            return status === 3;
        });

        let pool = [];

        if (priority.length > 0) {
            pool = priority;
        } else if (selected.length > 0) {
            pool = selected;
        } else {
            pool = workers.filter(w =>
                !unavailable.includes(w) &&
                shiftCount[w.id] < (w.monthly_shifts || 999)
            );
        }

        if (pool.length === 0) {
            schedule[day] = [];
            continue;
        }

        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const assigned = shuffled.slice(0, 1);

        schedule[day] = assigned.map(w => w.name);
        assigned.forEach(w => shiftCount[w.id]++);
    }

    return schedule;
}