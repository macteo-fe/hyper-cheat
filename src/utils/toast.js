export function showToast(message, type = 'success', duration = 2500) {
    let container = document.getElementById('app_toast_container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app_toast_container';
        container.className = 'app-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}
