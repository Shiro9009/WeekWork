<!-- EmployerView.vue -->
<template>
    <div class="employer-page">
        <h1>Управление расписанием</h1>

        <div v-if="loading">Загрузка...</div>

        <div v-else>
            <div class="workers">
                <h2>Подчинённые</h2>
                <ul>
                    <li v-for="worker in workers" :key="worker.id">
                        {{ worker.name }}
                    </li>
                </ul>
            </div>

            <div class="options" v-if="options && options.length > 0">
                <h2>Варианты судьбы плебеев</h2>
                <div v-for="option in options" :key="option.option_number" class="option-card">
                    <h3>Вариант {{ option.option_number }}</h3>
                    <div v-for="(names, day) in option.schedule" :key="day">
                        <strong>{{ day }}:</strong> {{ names.join(', ') }}
                    </div>
                    <button @click="chooseOption(option.option_number)">Выбрать этот вариант</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            workers: [],
            options: [],
            loading: true
        };
    },
    async mounted() {
        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;

        if (!user) {
            alert('Ошибка: пользователь не авторизован');
            return;
        }

        try {
            const response = await fetch(`/api/employer-data?telegram_id=${user.id}`);
            const data = await response.json();

            this.workers = data.workers || [];
            this.options = data.options || [];
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        } finally {
            this.loading = false;
        }
    },
    methods: {
        async chooseOption(optionNumber) {
            const tg = window.Telegram?.WebApp;
            const user = tg?.initDataUnsafe?.user;

            if (!user) {
                alert('Пользователь не авторизован');
                return;
            }

            const weekStart = this.options[0]?.week_start;

            if (!weekStart) {
                alert('Не найдена дата недели');
                return;
            }

            try {
                const response = await fetch('/api/choose-option', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        telegram_id: user.id,
                        option_number: optionNumber,
                        week_start: weekStart
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert('Расписание выбрано!');
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                console.error('Ошибка отправки:', error);
                alert('Не удалось отправить данные');
            }
        }
    }
};
</script>