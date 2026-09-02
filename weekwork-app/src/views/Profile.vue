<template>
    <div class="body">
        <img class="close-btn" @click="goBack" src="/close-btn.svg" alt="крестик">
        <section class="info">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Аватар" class="icon" />
            <div v-else class="icon" style=" border: 2px solid #7C6BC4;"></div>
            <p class="name">{{ user.first_name }}</p>
            <p class="role">{{ role === 'employer' ? 'Работодатель' : 'Работник' }}</p>
        </section>
        <section v-if="role === 'worker'" class="employer">
            <div class="employer-item">
                <h4 class="employer-item-title">Работодатель</h4>
                <div class="employer-item-info">
                    <img src="/shopping-bag.svg" alt="пакет" class="markert-icon">
                    <div class="employer-username-img">
                        <img src="/user.svg" alt="челоовек" class="user-img">
                        <p class="employer-name">@{{ employerUsername }} </p>
                    </div>
                </div>
            </div>
        </section>
        <section v-if="role === 'worker'" class="isOnLeave">
            <div class="isOnLeave-item">
                <div class="left">
                    <h3 class="left-title">Не брать смены</h3>
                    <p class="left-text">Отпуск / Экзамены / Личные причины</p>
                </div>
                <div class="rigth">
                    <input class="leave-toggle" id="leave-toggle" type="checkbox" v-model="isOnLeave" @change="toggleLeave">
                    <label for="leave-toggle"></label>
                </div>
            </div>
        </section>
    </div>
</template>

<script>
const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
    data() {
        return {
            isOnLeave: false,
            loading: true,
            avatarUrl: null,
            employerUsername: null,
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

        await this.fetchAvatar();

        if (this.user && this.user.employer_id) {
            try {
                const response = await fetch(`${API_URL}/api/employer-info?employer_id=${this.user.employer_id}`);
                const data = await response.json();
                if (data.username) {
                    this.employerUsername = data.username;
                }
            } catch (error) {
                console.error('Ошибка загрузки работодателя:', error);
            }
        }
        
        if (this.role === 'worker') {
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
            if (this.role !== 'worker') {
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
                } 
                // else {
                //     alert('Статус обновлён');
                // }
            } catch (error) {
                console.log('Ошибка: ', error);
                this.isOnLeave = !this.isOnLeave;
                alert('Не удалось обновить статус');
            }
        },
        async fetchAvatar() {
            if (!this.user || !this.user.id) return;
            try {
                const response = await fetch(`${API_URL}/api/user-avatar?telegram_id=${this.user.id}`);
                const data = await response.json();
                if (data.success && data.avatarUrl) {
                    this.avatarUrl = data.avatarUrl;
                }
            } catch (error) {
                console.error('Ошибка загрузки аватарки:', error);
            }
        },
    }
};
</script>

<style scoped>
.info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.icon {
    border-radius: 50px;
    width: 70px;
    height: 70px;
    object-fit: cover;
}

.name {
    color: #111827;
    font-size: 20px;
    font-weight: 600;
    margin-top: 20px;
}

.role {
    text-transform: uppercase;
    font-size: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 100px;
    max-width: 170px;
    min-width: 72px;
    height: 19px;
    padding: 0 5px;
}

.close-btn {
    position: absolute;
    right: 15px;
    top: 10px;
    width: 30px;
}

.employer-item {
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 16px;
    width: 358px;
    height: 80px;
    background: #fff;
    margin: 10px auto;
}

.employer-item-title {
    display: flex;
    text-transform: uppercase;
    font-weight: 700;
    font-size: 14px;
    text-transform: uppercase;
    color: #6b7280;
}

.employer-item-info {
    display: flex;
    gap: 20px;
    margin-top: 15px;
    align-items: center;
}

.markert-icon {
    width: 25px;
    background: #f3f4f6;
    border-radius: 8px;
    padding: 10px;
}

.employer-username-img {
    display: flex;
    gap: 10px;
    align-items: center;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 4px 8px;
    max-width: 241px;
    min-width: 141;
    height: 21px;
}

.user-img {
    width: 18px;
}

.employer-name {
    font-weight: 400;
    font-size: 18px;
    color: #6b7280;
}

.isOnLeave-item {
    display: flex;
    align-items: center;
    margin: 40px auto;
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.05);
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 16px;
    width: 358px;
    height: 72px;
}

.left-title {
    font-weight: 600;
    font-size: 19px;
    color: #111827;
    text-align: start;
}

.left-text {
    text-align: start;
    font-weight: 400;
    font-size: 15px;
    color: #6b7280;
}

.rigth {
    display: flex;
    margin-left: 10px;
}

#leave-toggle {
    visibility: hidden;
}

label {
    cursor: pointer;
    width: 65px;
    height: 35px;
    background-color:  #f3f4f6;
    border-radius: 100px;
    position: relative;
}

label::after {
    content: "";
    position: absolute;
    top: 5px;
    left: 5px;
    width: 25px;
    height: 25px;
    background-color: #7c6bc4;
    border-radius: 90px;
    transition: 0.3s;
}

input:checked + label {
    background-color: #7c6bc4;

}

input:checked + label::after {
    left: calc(100% - 5px);
    transform: translateX(-100%);
    background-color: #fff;
}
</style>