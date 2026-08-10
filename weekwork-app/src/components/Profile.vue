<template>
    <div class="profile">
        <h2>Профиль раба</h2>
        <p>{{ user.first_name }}</p>
        <p>@{{ user.username }}</p>
        <div class="leave-toggle">
            <label>
                <input type="checkbox" v-model="isOnLeave" @change="toggleLeave">
                {{ isOnLeave ? 'В отупске' : 'пиздуй работать'}}
            </label>
        </div>
        <button @click="goBack">Назад</button>
    </div>

</template>

<script>
export default {
    data() {
        return {
            isOnLeave: false,
            loading: true,
        }
    },
    props: {
        user: {
            type: Object,
            required: true,
        }
    },
    async mounted() {
        try {
            const response = await fetch(`/api/user-status?telegram_id=${this.user.id}`);
            const data = await response.json();
            this.isOnLeave = data.is_on_leave || false;
        } catch (error) {
            console.log('Ошибка загрузки статуса:', error);
        } finally {
            this.loading = true;
        }
    },
    methods: {
        goBack() {
            this.$router.go(-1);
        },
        
    }
};
</script>