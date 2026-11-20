import './bootstrap';

document.addEventListener('alpine:init', () => {
    Alpine.store('auth', { open: false });

    Alpine.data('dayXBanner', (launchAtIso) => ({
        launchAt: new Date(launchAtIso).getTime(),
        now: Date.now(),
        timer: null,
        init() {
            this.timer = setInterval(() => {
                this.now = Date.now();
            }, 1000);
        },
        destroy() {
            clearInterval(this.timer);
        },
        get launched() {
            return this.now >= this.launchAt;
        },
        get dayNumber() {
            return Math.floor((this.now - this.launchAt) / 86400000) + 1;
        },
        get remaining() {
            const left = Math.max(0, this.launchAt - this.now);

            return [
                { label: 'DIAS', value: Math.floor(left / 86400000) },
                { label: 'HORAS', value: Math.floor(left / 3600000) % 24 },
                { label: 'MIN', value: Math.floor(left / 60000) % 60 },
                { label: 'SEG', value: Math.floor(left / 1000) % 60 },
            ];
        },
    }));
});
