import { ModelInfo } from '../ai/types';
import { aiHub } from '../ai/registry';

export class ModelDropdownUI {
    private dropdownElement: HTMLElement;
    private modelListElement: HTMLElement;
    private isOpen = false;

    constructor() {
        this.dropdownElement = document.getElementById('belive-ai-picker')!;
        this.modelListElement = this.dropdownElement.querySelector('.model-list')!;

        if (!this.dropdownElement || !this.modelListElement) {
            console.error('ModelDropdownUI: Ошибка: не найдены элементы UI для выпадающего списка моделей.');
            return;
        }

        this.init();
    }

    private init(): void {
        this.renderModels();
        // Обработчик для закрытия дропдауна при клике вне его
        document.addEventListener('click', (e) => {
            if (!this.dropdownElement.contains(e.target as Node)) {
                this.closeDropdown();
            }
        });

        // Подписка на изменение модели из aiHub для перерисовки списка
        aiHub.on('modelChanged', () => this.renderModels());
    }

    private renderModels(): void {
        this.modelListElement.innerHTML = '';
        const models = aiHub.getAllModels();
        const activeModelId = aiHub.getActiveModel()?.id;

        models.forEach((model: ModelInfo) => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            if (model.id === activeModelId) {
                modelItem.classList.add('active');
            }
            modelItem.dataset.modelId = model.id;

            modelItem.innerHTML = `
                <span class="model-name">${model.shortName}</span>
                <span class="model-badge">${model.costTier}</span>
            `;

            modelItem.addEventListener('click', () => {
                aiHub.setActiveModel(model.id);
                this.closeDropdown();
            });
            this.modelListElement.appendChild(modelItem);
        });
    }

    public openAt(anchor: HTMLElement): void {
        const rect = anchor.getBoundingClientRect();
        Object.assign(this.dropdownElement.style, {
            left: `${rect.left}px`,
            top: `${rect.bottom + 8}px`,
        });
        this.dropdownElement.classList.add('active');
        this.isOpen = true;
    }

    public closeDropdown(): void {
        this.dropdownElement.classList.remove('active');
        this.isOpen = false;
    }

    public toggleDropdown(): void {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            // Этого метода уже не будет напрямую вызываться из кнопки "Operator"
            // openAt будет вызываться из AIChatUI
            console.warn('ModelDropdownUI: toggleDropdown вызван без якоря. Используйте openAt(anchor).');
            this.dropdownElement.classList.toggle('active');
            this.isOpen = this.dropdownElement.classList.contains('active');
        }
    }
}
