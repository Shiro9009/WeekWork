<template>
    <div class="profile">
        <h2>Профиль</h2>
        <p>{{ user.first_name }}</p>
        <p>@{{ user.username }}</p>
        <p>Роль: {{ role === 'employer' ? 'Работодатель' : 'Работник' }}</p>

        <div v-if="role === 'worker'" class="leave-toggle">
            <label>
                <input type="checkbox" v-model="isOnLeave" @change="toggleLeave">
                {{ isOnLeave ? 'В отпуске' : 'Активен' }}
            </label>
        </div>

        <button @click="goBack">Назад</button>
    </div>
</template>

<script>
const API_URL = 'https://weekwork-production-381f.up.railway.app';

export default {
    data() {
        return {
            isOnLeave: false,
            loading: true,
        }
    },
    computed: {
        user() {
            if (this.$route.query.user) {
                try {
                    return JSON.parse(this.$route.query.user);
                } catch (e) {
                    return null;
                }
            }
            return this.$parent.user || null;
        },
        role() {
            return this.$route.query.role || null;
        }
    },
    async mounted() {
        if (!this.user) {
            alert('Пользователь не авторизован');
            this.$router.push('/');
            return;
        }
        if (this.user.role === 'worker') {
            try {
                const response = await fetch(`${API_URL}/api/user-status?telegram_id=${this.user.id}`);
                const data = await response.json();
                this.isOnLeave = data.is_on_leave || false;
            } catch (error) {
                console.log('Ошибка загрузки статуса:', error);
            } finally {
                this.loading = false;
            }
        } else {
            this.loading = false;
        }
    },
    methods: {
        goBack() {
            this.$router.go(-1);
        },
        async toggleLeave() {
            if (this.user.role !== 'worker') {
                alert('Только работники могут менять статус отпуска');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/toggle-leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: this.user.id,
                        is_on_leave: this.isOnLeave,
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    this.isOnLeave = !this.isOnLeave;
                    alert('Ошибка обновления статуса');
                } else {
                    alert('Статус обновлён');
                }
            } catch (error) {
                console.log('Ошибка: ', error);
                this.isOnLeave = !this.isOnLeave;
                alert('Не удалось обновить статус');
            }
        }
    }
};
</script>