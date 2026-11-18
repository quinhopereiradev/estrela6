import './bootstrap';

document.addEventListener('alpine:init', () => {
    Alpine.store('auth', { open: false });
});
