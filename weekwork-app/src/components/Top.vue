<template>
    <div class="header">
        <div class="name-ava">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Аватар" class="icon" />
            <div v-else class="icon" style="background: #7C6BC4; border: none;"></div>
            <p v-if="user && user.first_name" class="first_name" @click="goToProfile">{{ user.first_name }}</p>
        </div>
        <h2 class="title">WeekWork</h2>
    </div>
</template>

<script>
const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
    data() {
        return {
            avatarUrl: null
        };
    },
    props: {
        user: {
            type: Object,
            required: true,
        }
    },
    watch: {
        user: {
            immediate: true,
            handler(newUser) {
                if (newUser && newUser.id) {
                    this.fetchAvatar();
                }
            }
        }
    },
    methods: {
        async fetchAvatar() {
            if (!this.user || !this.user.id) return;
            try {
                // ИСПРАВЛЕНО: ? вместо &
                const response = await fetch(`${API_URL}/api/user-avatar?telegram_id=${this.user.id}`);
                const data = await response.json();
                if (data.success && data.avatarUrl) {
                    this.avatarUrl = data.avatarUrl;
                }
            } catch (error) {
                console.error('Ошибка загрузки аватарки:', error);
            }
        },
        goToProfile() {
            this.$emit('open-profile');
        }
    }
}
</script>

<style scoped>
.header {
    background-color: #FFFFFF;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 11px;
    border-bottom: 1px solid #d8d8d8;
}

.icon {
    border-radius: 50px;
    width: 40px;
    height: 40px;
    object-fit: cover;
}

.name-ava {
    display: flex;
    align-items: center;
    gap: 20px;
}

.title {
    color: #7C6BC4;
    font-size: 22px;
    font-weight: 600;
}

.first_name {
    color: #000;
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
}
</style>