export function showConfirmDialog({
    title = 'Confirm',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
} = {}) {
    return new Promise((resolve) => {
        const existing = document.getElementById('app_confirm_dialog');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'app_confirm_dialog';
        overlay.className = 'app-confirm-overlay';
        overlay.innerHTML = `
            <div class="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="app_confirm_title">
                <h3 id="app_confirm_title" class="app-confirm-title">${title}</h3>
                <p class="app-confirm-message">${message}</p>
                <div class="app-confirm-actions">
                    <button type="button" class="btn btn-secondary btn-ghost" data-action="cancel">${cancelLabel}</button>
                    <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${confirmLabel}</button>
                </div>
            </div>
        `;

        const finish = (result) => {
            document.removeEventListener('keydown', onKeyDown, true);
            overlay.remove();
            resolve(result);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                finish(false);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                finish(true);
            }
        };

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) finish(false);
            const action = event.target.closest('[data-action]')?.dataset?.action;
            if (action === 'cancel') finish(false);
            if (action === 'confirm') finish(true);
        });

        document.addEventListener('keydown', onKeyDown, true);
        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('[data-action="confirm"]');
        confirmBtn?.focus();
    });
}
