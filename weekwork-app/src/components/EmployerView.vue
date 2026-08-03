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
const API_URL = 'https://weekwork-production-381f.up.railway.app';

export default {
    data() {
        return {
            workers: [],
            options: [],
            loading: true
        };
    },
    async mounted() {
        // 1. Получаем данные пользователя (как в App.vue)
        let userData = null;

        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            userData = window.Telegram.WebApp.initDataUnsafe.user;
            console.log('Данные из window.Telegram: ', userData);
        }

        if (!userData) {
            const url = window.location.href;
            const match = url.match(/[#?]tgWebAppData=([^&]+)/);
            if (match) {
                try {
                    const decoded = decodeURIComponent(match[1]);
                    const params = new URLSearchParams(decoded);
                    const userParam = params.get('user');
                    if (userParam) {
                        userData = JSON.parse(decodeURIComponent(userParam));
                        console.log('Данные из URL: ', userData);
                    }
                } catch (e) {
                    console.log('Ошибка при парсинге данных из URL:', e);
                }
            }
        }

        if (!userData) {
            alert('Ошибка: пользователь не авторизован');
            this.loading = false;
            return;
        }

        // 2. Загружаем данные работодателя
        try {
            const response = await fetch(`${API_URL}/api/employer-data?telegram_id=${userData.id}`);
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
                const response = await fetch(`${API_URL}/api/choose-option`, {
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