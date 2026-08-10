<template>
    <div class="header">
        <div class="icon"></div>
        <div class="line"></div>
        <p v-if="user && user.first_name" class="first_name" @click="goToProfile">{{ user.first_name }}</p>
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
    background-color: #8713bd;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 11px;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
}

.icon {
    background-color: #fff;
    border-radius: 50px;
    width: 50px;
    height: 50px;
}

.line {
    border: 1px solid #af3afd;
    width: 130px;
    transform: rotateZ(30deg);
}

.first_name {
    color: #fff;
    font-size: 23px;
    font-weight: 600;
}
</style>