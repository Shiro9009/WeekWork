<template>
    <div class="header">
        <div class="name-ava">
            <div class="icon"></div>
            <p v-if="user && user.first_name" class="first_name" @click="goToProfile">{{ user.first_name }}</p>
        </div>
        <h2 class="title">WeekWork</h2>
    </div>
</template>

<script>
export default {
    data() {
        return {

        }
    },
    props: {
        user: {
            type: Object,
            required: true,
        }
    },
    methods: {
        goToProfile() {
            this.$emit('open-profile');
        },
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
    background-color: #fff;
    border-radius: 50px;
    width: 50px;
    height: 50px;
    border: 1px solid #000;
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
}
</style>