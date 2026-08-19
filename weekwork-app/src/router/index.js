import { createRouter, createWebHistory } from 'vue-router';
import Profile from '../views/Profile.vue';
import Week from '../components/Week.vue';
import EmployerView from '../components/EmployerView.vue';

const routes = [
    {
        path: '/',
        name: 'home',
    },
    {
        path: '/profile',
        name: 'profile',
        component: Profile,
        props: (route) => ({ user: route.query.user ? JSON.parse(route.query.user) : null })
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;